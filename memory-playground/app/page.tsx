'use client';
import { useRef, useState } from 'react';
import { useMemoryTools } from '@/lib/use-memory-tools';
import { BookmarkPlus, Search, ArrowUpRight, Check, LoaderCircle, CircleAlert, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
type Memory = { id: string; memory: string };
type State = 'idle' | 'remember' | 'recall' | 'saved' | 'found' | 'error';
export default function Home() {
  const [text, setText] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const inFlight = useRef(false);
  const busy = state === 'remember' || state === 'recall';
  async function run(action: 'remember' | 'recall', input = text) {
    if (inFlight.current) return { error: 'A memory request is already running.' };
    if (!input.trim()) return { error: 'Enter a thought or question first.' };
    setText(input);
    inFlight.current = true;
    setState(action);
    setMessage(action === 'remember' ? 'Saving your memory…' : 'Looking through your memories…');
    setMemories([]);
    try {
      const response = await fetch(`/api/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() }), signal: AbortSignal.timeout(120000),
      });
      const data = await response.json() as { error?: string; memories?: Memory[]; message: string };
      if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setMemories(data.memories ?? []);
      setState(action === 'recall' ? 'found' : 'saved');
      setMessage(data.message);
      return data;
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error && error.name === 'TimeoutError'
        ? 'This is taking longer than expected. Try Recall to check whether your memory was saved.'
        : error instanceof TypeError ? 'Could not connect. Check your connection and try again.'
        : error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      return { error: 'The memory request failed. See the page for details.' };
    } finally { inFlight.current = false; }
  }
  useMemoryTools(run);
  return (
    <main className="playground"><div className="playground-wrap">
      <div className="prototype-label"><span className="label-dot" />Patchy plugin prototype</div>
      <section className="memory-card" aria-labelledby="title">
        <header className="card-heading">
          <span className="heading-icon"><Layers size={22} strokeWidth={1.7} aria-hidden="true" /></span>
          <h1 id="title">Memory Playground</h1><p>A little context. A longer memory.</p>
        </header>
        <div className="workspace">
          <label htmlFor="memory-text">What’s on your mind?</label>
          <p id="input-help" className="input-help">Save a thought, or ask for something you’ve remembered.</p>
          <Textarea id="memory-text" value={text} onChange={(event) => setText(event.target.value)}
            placeholder="We’re building an intelligence layer for Patchy, starting small with Mem0."
            maxLength={4000} disabled={busy} aria-describedby="input-help" className="memory-input" />
          <div className="actions">
            <Button className="remember-button" disabled={busy || !text.trim()} onClick={() => run('remember')}>
              {state === 'remember' ? <LoaderCircle className="spinner" /> : <BookmarkPlus />}Remember
            </Button>
            <Button variant="outline" className="recall-button" disabled={busy || !text.trim()} onClick={() => run('recall')}>
              {state === 'recall' ? <LoaderCircle className="spinner" /> : <Search />}Recall
            </Button>
          </div>
        </div>
        <section className="results" aria-labelledby="results-title" aria-busy={busy}>
          <div className="results-heading"><h2 id="results-title">{state === 'saved' ? 'Remembered' : 'Your memories'}</h2><span>{memories.length ? `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}` : 'A place for context'}</span></div>
          <div role={state === 'error' ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">
            {state === 'idle' ? <Empty className="empty-state"><Search size={21} strokeWidth={1.5} aria-hidden="true" /><EmptyTitle>Start with something worth remembering.</EmptyTitle><EmptyDescription>Your saved memories and recall results will appear here.</EmptyDescription></Empty>
              : <p className={`status-message ${state === 'error' ? 'error-message' : ''}`}>
                {busy ? <LoaderCircle size={17} className="spinner" /> : state === 'error' ? <CircleAlert size={17} /> : state === 'saved' ? <Check size={17} /> : <Search size={17} />}{message}
              </p>}
          </div>
          {memories.length > 0 && <ul className="memory-list">{memories.map((memory) => <li key={memory.id}><BookmarkPlus size={17} aria-hidden="true" /><p>{memory.memory}</p></li>)}</ul>}
        </section>
        <footer className="card-footer"><span className="footer-dot" />One demo user. Stored on this computer.</footer>
      </section>
      <p className="page-footer">The first building block of Patchy intelligence.<span>Powered by <a href="https://mem0.ai" target="_blank" rel="noreferrer">Mem0 <ArrowUpRight size={12} aria-hidden="true" /></a></span></p>
    </div></main>
  );
}
