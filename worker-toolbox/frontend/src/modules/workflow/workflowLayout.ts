/**
 * Workflow DAG 布局算法。
 */

export interface LayoutNode { id: string }
export interface LayoutEdge { from: string; to: string; fromOutput?: string }

/** 拓扑层级：source（无入边）= level 0，其余 = max(前驱 level) + 1 */
export function computeLevels(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Map<string, number> {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  })
  edges.forEach((e) => {
    if (!inDegree.has(e.to)) inDegree.set(e.to, 0)
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)!.push(e.to)
  })

  const levels = new Map<string, number>()
  const queue: string[] = []
  inDegree.forEach((deg, nid) => {
    if (deg === 0) {
      levels.set(nid, 0)
      queue.push(nid)
    }
  })

  // BFS: 多次遍历以处理所有节点
  while (queue.length) {
    const nid = queue.shift()!
    const curLevel = levels.get(nid) ?? 0
    const neighbors = adj.get(nid) ?? []
    neighbors.forEach((to) => {
      const newLevel = curLevel + 1
      if (!levels.has(to) || levels.get(to)! < newLevel) {
        levels.set(to, newLevel)
      }
      // 检查 to 的所有前驱是否都已计算
      const allPredsComputed = edges
        .filter((e) => e.to === to)
        .every((e) => levels.has(e.from))
      if (allPredsComputed && !queue.includes(to)) {
        queue.push(to)
      }
    })
  }

  // fallback: 未赋值的节点赋值 0
  nodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 0)
  })

  return levels
}

/** 按 level 分组，返回 level 递增的二维数组 */
export function groupByLevel(
  nodes: LayoutNode[],
  levels: Map<string, number>,
): LayoutNode[][] {
  const maxLevel = Math.max(0, ...Array.from(levels.values()))
  const groups: LayoutNode[][] = Array.from({ length: maxLevel + 1 }, () => [])
  nodes.forEach((n) => {
    const lv = levels.get(n.id) ?? 0
    groups[lv].push(n)
  })
  return groups
}

export interface AutoLayoutOptions {
  nodeWidth?: number   // default 260
  nodeHeight?: number  // default 400
  hGap?: number        // horizontal gap, default 50
  vGap?: number        // vertical gap, default 110
  padding?: number     // canvas padding, default 50
}

/** 自动计算节点位置（拓扑层级布局），返回 { [nodeId]: { x, y } } */
export function autoLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts?: AutoLayoutOptions,
): Record<string, { x: number; y: number }> {
  const { nodeWidth = 260, nodeHeight = 400, hGap = 50, vGap = 110, padding = 50 } = opts ?? {}
  const levels = computeLevels(nodes, edges)
  const rows = groupByLevel(nodes, levels)
  const positions: Record<string, { x: number; y: number }> = {}

  rows.forEach((row, ri) => {
    const totalRowWidth = row.length * nodeWidth + (row.length - 1) * hGap
    const startX = padding
    row.forEach((node, ci) => {
      positions[node.id] = {
        x: startX + ci * (nodeWidth + hGap),
        y: padding + ri * (nodeHeight + vGap),
      }
    })
  })

  return positions
}

/** 计算 canvas 最小所需尺寸 */
export function canvasSize(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  opts?: AutoLayoutOptions,
): { width: number; height: number } {
  const { nodeWidth = 260, nodeHeight = 400, hGap = 50, vGap = 110, padding = 50 } = opts ?? {}
  const levels = computeLevels(nodes, edges)
  const rows = groupByLevel(nodes, levels)
  const maxNodesInRow = Math.max(1, ...rows.map(r => r.length))
  const width = padding * 2 + maxNodesInRow * nodeWidth + (maxNodesInRow - 1) * hGap
  const height = rows.length === 0 ? 200 : padding * 2 + rows.length * nodeHeight + (rows.length - 1) * vGap
  return { width: Math.max(700, width), height: Math.max(500, height) }
}
