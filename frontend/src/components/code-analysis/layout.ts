// frontend/src/components/code-analysis/layout.ts
//
// 轻量级层级布局算法（避免引入 dagre）。
// 思路：
//   - 按入度做拓扑分层（入度为 0 的节点放第 0 层）
//   - 同层节点等间距横向排列
//   - 处理环：剩余节点放到当前最大层 + 1
//
// 输入 / 输出都是 reactflow 的 Node/Edge 简化形态。

import type { CSSProperties } from 'react';

export interface LayoutNode {
  id: string;
  data: Record<string, unknown>;
  type?: string;
  // 如果 caller 已给定位置，会被尊重；否则布局负责赋值
  position?: { x: number; y: number };
  // 提示信息
  style?: CSSProperties;
  className?: string;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
  style?: CSSProperties;
  className?: string;
  data?: Record<string, unknown>;
  markerEnd?: { type: string; color?: string };
}

interface LayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeHeight?: number;
  hGap?: number;
  vGap?: number;
}

/**
 * 简单层级布局：按入度拓扑分层，每层等距排列。
 * 时间复杂度 O(V + E)，无第三方依赖。
 */
export function layoutGraph<N extends LayoutNode, E extends LayoutEdge>(
  nodes: N[],
  edges: E[],
  options: LayoutOptions = {},
): N[] {
  const direction = options.direction ?? 'LR';
  const nodeWidth = options.nodeWidth ?? 180;
  const nodeHeight = options.nodeHeight ?? 40;
  const hGap = options.hGap ?? 60;
  const vGap = options.vGap ?? 24;

  if (nodes.length === 0) return nodes;

  // 1) 邻接表 + 入度
  const inDegree = new Map<string, number>();
  const outAdj = new Map<string, string[]>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outAdj.set(n.id, []);
  }
  for (const e of edges) {
    if (!inDegree.has(e.target) || !inDegree.has(e.source)) continue;
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    outAdj.get(e.source)!.push(e.target);
  }

  // 2) 拓扑分层（Kahn）
  const layer = new Map<string, number>();
  let frontier: string[] = [];
  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      frontier.push(n.id);
      layer.set(n.id, 0);
    }
  }
  // 没有源点（全是环），随便挑一个起点
  if (frontier.length === 0 && nodes.length > 0) {
    frontier.push(nodes[0].id);
    layer.set(nodes[0].id, 0);
  }

  while (frontier.length) {
    const next: string[] = [];
    for (const u of frontier) {
      const lu = layer.get(u) ?? 0;
      for (const v of outAdj.get(u) ?? []) {
        const lv = Math.max(layer.get(v) ?? 0, lu + 1);
        const existing = layer.get(v);
        if (existing === undefined || lv > existing) {
          layer.set(v, lv);
          next.push(v);
        }
      }
    }
    frontier = next;
  }

  // 3) 没排到的节点（环上的）追加到最大层 + 1
  let maxLayer = 0;
  for (const v of layer.values()) maxLayer = Math.max(maxLayer, v);
  for (const n of nodes) {
    if (!layer.has(n.id)) {
      maxLayer += 1;
      layer.set(n.id, maxLayer);
    }
  }

  // 4) 按层分组
  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0;
    let arr = byLayer.get(l);
    if (!arr) {
      arr = [];
      byLayer.set(l, arr);
    }
    arr.push(n.id);
  }
  for (const arr of byLayer.values()) arr.sort();

  // 5) 赋坐标
  const posMap = new Map<string, { x: number; y: number }>();
  const sortedLayers = Array.from(byLayer.keys()).sort((a, b) => a - b);
  for (const l of sortedLayers) {
    const ids = byLayer.get(l)!;
    ids.forEach((id, idx) => {
      if (direction === 'LR') {
        posMap.set(id, {
          x: l * (nodeWidth + hGap),
          y: idx * (nodeHeight + vGap),
        });
      } else {
        posMap.set(id, {
          x: idx * (nodeWidth + hGap),
          y: l * (nodeHeight + vGap),
        });
      }
    });
  }

  return nodes.map((n) => ({
    ...n,
    position: n.position ?? posMap.get(n.id) ?? { x: 0, y: 0 },
  }));
}
