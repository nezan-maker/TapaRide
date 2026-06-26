import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { cn } from '../lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with Apple-style typography.
 * Supports: headings, bold, italic, lists, code blocks, links, tables.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const components: Components = {
    h1: ({ children }) => (
      <h1 className="text-xl font-extrabold text-ink-900 mt-4 mb-2 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-bold text-ink-900 mt-3 mb-1.5 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-semibold text-ink-900 mt-2 mb-1 first:mt-0">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-[15px] leading-relaxed mb-2 last:mb-0">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-ink-900">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-ink-600">{children}</em>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-5 mb-2 space-y-0.5 text-ink-700">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 mb-2 space-y-0.5 text-ink-700">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-[15px] leading-relaxed">{children}</li>
    ),
    code: ({ className: codeClassName, children }) => {
      const isBlock = codeClassName?.includes('language-');
      if (isBlock) {
        return (
          <pre className="bg-ink-50 border border-ink-100 rounded-xl p-3 mb-2 overflow-x-auto">
            <code className="text-sm font-mono text-ink-800">{children}</code>
          </pre>
        );
      }
      return (
        <code className="bg-ink-50 text-flame-700 px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    },
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-flame-600 underline decoration-flame-300 hover:decoration-flame-600 transition"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-flame-300 pl-3 my-2 text-ink-600 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-ink-100 my-3" />,
    table: ({ children }) => (
      <div className="overflow-x-auto mb-2 rounded-xl border border-ink-100">
        <table className="min-w-full divide-y divide-ink-100 text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-ink-50">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-ink-700">{children}</td>
    ),
  };

  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
