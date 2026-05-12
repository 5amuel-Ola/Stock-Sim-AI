// Strip markdown artifacts and excessive formatting from AI responses
export function cleanResponse(text: string): string {
  // Strip ** for bold
  let cleaned = text.replace(/\*\*(.+?)\*\*/g, '$1')
  
  // Strip single * for italic
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1')
  
  // Strip __ for bold/italic
  cleaned = cleaned.replace(/__(.+?)__/g, '$1')
  cleaned = cleaned.replace(/_(.+?)_/g, '$1')
  
  // Strip code fences
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '')
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1')
  
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n')
  
  return cleaned.trim()
}
