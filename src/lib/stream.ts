// SSE 流式请求工具函数
import ky, { type KyResponse, type AfterResponseHook, type NormalizedOptions } from 'ky';
import { createParser, type EventSourceParser } from 'eventsource-parser';

/**
 * SSE 选项接口
 */
export interface SSEOptions {
  /** 接收到数据时的回调 */
  onData: (data: string) => void;
  /** 接收到事件时的回调（可选） */
  onEvent?: (event: any) => void;
  /** 流式响应完成时的回调（可选） */
  onCompleted?: (error?: Error) => void;
  /** 请求被中断时的回调（可选） */
  onAborted?: () => void;
}

/**
 * 创建 SSE Hook 用于处理流式响应
 * @param options SSE 选项
 * @returns AfterResponseHook
 */
export const createSSEHook = (options: SSEOptions): AfterResponseHook => {
  const hook: AfterResponseHook = async (
    request: Request,
    _options: NormalizedOptions,
    response: KyResponse
  ) => {
    // 检查响应是否有效
    if (!response.ok || !response.body) {
      return;
    }

    let completed = false;
    const innerOnCompleted = (error?: Error): void => {
      if (completed) return;
      completed = true;
      options.onCompleted?.(error);
    };

    // 获取响应流的 reader
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf8');

    // 创建 SSE 解析器
    const parser: EventSourceParser = createParser({
      onEvent: (event) => {
        if (event.data) {
          options.onEvent?.(event);
          // 处理单 message 多 data 字段的场景
          const dataArray: string[] = event.data.split('\n');
          for (const data of dataArray) {
            if (data.trim()) {
              options.onData(data);
            }
          }
        }
      }
    });

    // 递归读取流数据
    const read = (): void => {
      reader.read().then((result) => {
        if (result.done) {
          innerOnCompleted();
          return;
        }

        // 将数据喂给解析器
        parser.feed(decoder.decode(result.value, { stream: true }));
        read();
      }).catch(error => {
        // 判断是否是手动中断
        if (request.signal.aborted) {
          options.onAborted?.();
          return;
        }
        innerOnCompleted(error as Error);
      });
    };

    read();
    return response;
  };

  return hook;
};

/**
 * 流式请求选项接口
 */
export interface StreamRequestOptions {
  /** Edge Function URL */
  functionUrl: string;
  /** 请求体 */
  requestBody: any;
  /** Supabase 匿名密钥 */
  supabaseAnonKey: string;
  /** 接收到每个 SSE 数据块的回调 */
  onData: (data: string) => void;
  /** 请求完成回调 */
  onComplete: () => void;
  /** 错误处理回调 */
  onError: (error: Error) => void;
  /** 中断信号（可选） */
  signal?: AbortSignal;
}

/**
 * 发送流式请求到 Supabase Edge Function
 * @param options 流式请求选项
 */
export const sendStreamRequest = async (options: StreamRequestOptions): Promise<void> => {
  const {
    functionUrl,
    requestBody,
    supabaseAnonKey,
    onData,
    onComplete,
    onError,
    signal
  } = options;

  const sseHook = createSSEHook({
    onData,
    onCompleted: (error?: Error) => {
      if (error) {
        onError(error);
      } else {
        onComplete();
      }
    },
    onAborted: () => {
      console.log('请求已中断');
    }
  });

  try {
    await ky.post(functionUrl, {
      json: requestBody,
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      signal,
      hooks: {
        afterResponse: [sseHook]
      }
    });
  } catch (error) {
    if (!signal?.aborted) {
      onError(error as Error);
    }
  }
};
