'use client';

import Image from 'next/image';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  isAllowedMarkdownImageUrl,
  sanitizeMarkdownLinkUrl,
  markdownUrlTransform,
} from '@/lib/chat-markdown';

const markdownComponents: Components = {
  p({ children }) {
    return <p className="my-1 leading-6">{children}</p>;
  },
  h1({ children }) {
    return <h2 className="mb-2 mt-4 font-headline text-lg font-semibold text-on-surface">{children}</h2>;
  },
  h2({ children }) {
    return <h3 className="mb-2 mt-4 font-headline text-base font-semibold text-on-surface">{children}</h3>;
  },
  h3({ children }) {
    return <h4 className="mb-1.5 mt-3 font-headline text-sm font-semibold text-on-surface">{children}</h4>;
  },
  ul({ children }) {
    return <ul className="my-2 flex list-disc flex-col gap-1 pl-5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-2 flex list-decimal flex-col gap-1 pl-5">{children}</ol>;
  },
  li({ children }) {
    return <li className="pl-1 leading-6">{children}</li>;
  },
  a({ href, children }) {
    const safeHref = sanitizeMarkdownLinkUrl(href);
    if (!safeHref) return <span>{children}</span>;
    const external = safeHref.startsWith('http://') || safeHref.startsWith('https://');
    return (
      <a
        href={safeHref}
        className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    const imageSrc = typeof src === 'string' ? src : '';
    if (!isAllowedMarkdownImageUrl(imageSrc)) return null;
    return (
      <Image
        src={imageSrc}
        alt={alt || 'График'}
        width={1200}
        height={675}
        unoptimized
        className="my-3 max-h-[26rem] w-full rounded-lg border border-outline-variant/20 object-contain"
        sizes="(max-width: 768px) 100vw, 46rem"
        style={{ height: 'auto' }}
      />
    );
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-outline-variant/20">
        <table className="min-w-full border-collapse text-left text-xs">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-surface-container/70 text-on-surface">{children}</thead>;
  },
  th({ children }) {
    return <th className="border-b border-outline-variant/20 px-3 py-2 font-semibold">{children}</th>;
  },
  td({ children }) {
    return <td className="border-t border-outline-variant/10 px-3 py-2 align-top">{children}</td>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-3 border-l-2 border-primary/50 pl-3 text-on-surface-variant">
        {children}
      </blockquote>
    );
  },
  code({ children, className }) {
    const block = typeof className === 'string' && className.startsWith('language-');
    if (block) {
      return (
        <code className="block overflow-x-auto whitespace-pre rounded-lg bg-surface-container/70 p-3 font-mono text-[12px] leading-5 text-on-surface">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-surface-container/80 px-1.5 py-0.5 font-mono text-[0.86em] text-on-surface">
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <pre className="my-3 overflow-x-auto">{children}</pre>;
  },
  hr() {
    return <hr className="my-4 border-outline-variant/20" />;
  },
};

export default function MarkdownText({
  text,
  renderImages = true,
}: {
  text: string;
  renderImages?: boolean;
}) {
  return (
    <div className="chat-markdown whitespace-normal break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml
        urlTransform={markdownUrlTransform}
        components={{
          ...markdownComponents,
          ...(renderImages ? null : { img: () => null }),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
