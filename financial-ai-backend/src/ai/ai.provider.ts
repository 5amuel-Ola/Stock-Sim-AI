export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiProvider {
  chat(messages: ChatMessage[]): Promise<string>
  structuredJson<T>(messages: ChatMessage[]): Promise<T>
}