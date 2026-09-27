import { handleMemory } from '@/lib/memory';
export async function POST(request: Request) {
  return handleMemory(request, 'ask');
}
