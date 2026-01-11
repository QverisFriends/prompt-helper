// 群聊 Edge Function - 多Agent并发对话 + 决断官总结
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: string;
  content: string;
}

interface AgentResponse {
  agent_id: string;
  agent_name: string;
  content: string;
  error?: string;
}

interface RequestBody {
  user_message: string;
  agent_ids: string[];
  judge_id: string;
  conversation_history?: Message[];
}

// 调用单个Agent获取回复
async function callAgent(
  agentId: string,
  agentName: string,
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Message[] = []
): Promise<AgentResponse> {
  try {
    const apiUrl = 'https://api-integrations.appmiaoda.com/app-8uu3lcj3p0xt/api-Xa6JZMByJlDa/v2/chat/completions';
    
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        enable_thinking: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    // 读取流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            fullContent += content;
          } catch (e) {
            console.error('解析数据失败:', e);
          }
        }
      }
    }

    return {
      agent_id: agentId,
      agent_name: agentName,
      content: fullContent,
    };
  } catch (error) {
    console.error(`Agent ${agentName} 调用失败:`, error);
    return {
      agent_id: agentId,
      agent_name: agentName,
      content: '',
      error: error.message || '调用失败',
    };
  }
}

// 决断官总结
async function judgeSummary(
  judgeName: string,
  judgePrompt: string,
  userMessage: string,
  agentResponses: AgentResponse[]
): Promise<string> {
  try {
    const apiUrl = 'https://api-integrations.appmiaoda.com/app-8uu3lcj3p0xt/api-Xa6JZMByJlDa/v2/chat/completions';
    
    // 构建决断官的输入
    let expertsOpinions = '';
    agentResponses.forEach((resp, index) => {
      if (!resp.error && resp.content) {
        expertsOpinions += `\n\n[专家${index + 1} - ${resp.agent_name}的意见]:\n${resp.content}`;
      }
    });

    const judgeSystemPrompt = `${judgePrompt}\n\n你是一个会议主持人及决策者。你的任务是：
1. 阅读用户的问题以及团队成员的回答
2. 总结各方观点（指明是谁提出的）
3. 识别各方观点的冲突点和共同点
4. 基于你的专业身份，给出一个综合性的最终建议
5. 请直接对用户说话，不要提及"根据上下文"等技术词汇`;

    const messages: Message[] = [
      { role: 'system', content: judgeSystemPrompt },
      { role: 'user', content: `[用户问题]: ${userMessage}${expertsOpinions}\n\n请给出你的最终决断和建议。` },
    ];

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        enable_thinking: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`决断官API请求失败: ${response.status}`);
    }

    // 读取流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (!reader) {
      throw new Error('无法读取决断官响应流');
    }

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            fullContent += content;
          } catch (e) {
            console.error('解析决断官数据失败:', e);
          }
        }
      }
    }

    return fullContent;
  } catch (error) {
    console.error('决断官调用失败:', error);
    return `决断官总结失败: ${error.message}`;
  }
}

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_message, agent_ids, judge_id, conversation_history = [] }: RequestBody = await req.json();

    // 验证请求参数
    if (!user_message || !agent_ids || agent_ids.length === 0 || !judge_id) {
      return new Response(
        JSON.stringify({ error: { message: '缺少必要参数' } }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 初始化 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取所有Agent信息（包括决断官）
    const allAgentIds = [...agent_ids, judge_id];
    const { data: agents, error: agentsError } = await supabase
      .from('roles')
      .select('*')
      .in('id', allAgentIds);

    if (agentsError || !agents) {
      throw new Error('获取Agent信息失败');
    }

    // 分离普通Agent和决断官
    const normalAgents = agents.filter(a => agent_ids.includes(a.id));
    const judge = agents.find(a => a.id === judge_id);

    if (!judge) {
      throw new Error('未找到决断官信息');
    }

    // 第一阶段：并发调用所有普通Agent
    console.log(`开始并发调用 ${normalAgents.length} 个Agent...`);
    const agentPromises = normalAgents.map(agent =>
      callAgent(agent.id, agent.name, agent.system_prompt, user_message, conversation_history)
    );

    // 设置15秒超时
    const timeout = new Promise<AgentResponse[]>((_, reject) =>
      setTimeout(() => reject(new Error('Agent调用超时')), 15000)
    );

    const agentResponses = await Promise.race([
      Promise.all(agentPromises),
      timeout
    ]) as AgentResponse[];

    console.log(`Agent回复完成，成功: ${agentResponses.filter(r => !r.error).length}/${agentResponses.length}`);

    // 第二阶段：决断官总结
    console.log('开始决断官总结...');
    const judgeSummaryResult = await judgeSummary(judge.name, judge.system_prompt, user_message, agentResponses);
    console.log('决断官总结完成');

    // 返回结果
    return new Response(
      JSON.stringify({
        success: true,
        agent_responses: agentResponses,
        judge_summary: judgeSummaryResult,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Group Chat Edge Function 错误:', error);
    return new Response(
      JSON.stringify({ error: { message: error.message || '服务器内部错误' } }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
