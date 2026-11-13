// A ticket's description: adf.ts reads Jira's document into safe elements, and this draws
// them as React elements (never raw HTML). Wide tables and code scroll on their own.
import { createElement, type ReactNode } from "react";
import { ScrollArea } from "../../ui/index.ts";
import { readAdf, type AdfOut } from "./adf.ts";
import s from "./Adf.module.css";

const VOID = new Set(["hr", "br"]);

function draw(node: AdfOut, key: number): ReactNode {
  if (typeof node === "string") return node;
  const children = node.children.map(draw);
  if (node.role === "tableWrap") return <ScrollArea key={key} className={s.tableWrap}>{children}</ScrollArea>;
  if (node.tag === "pre") return <ScrollArea key={key} className={s.preWrap}><pre>{children}</pre></ScrollArea>;
  const props = {
    key,
    className: node.role ? s[node.role] : undefined,
    ...(node.tag === "a" && node.href ? { href: node.href, target: "_blank", rel: "noreferrer" } : {}),
  };
  return VOID.has(node.tag) ? createElement(node.tag, props) : createElement(node.tag, props, ...children);
}

export function Adf({ adf, fallback }: { adf: unknown; fallback: string }) {
  return <div className={s.adf}>{readAdf(adf, fallback).map(draw)}</div>;
}
