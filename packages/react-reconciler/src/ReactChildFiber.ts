import type { Fiber } from './ReactInternalTypes'
import { Placement, ChildDeletion } from './ReactFiberFlags'
import {
  createFiberFromElement,
  createFiberFromFragment,
  createFiberFromText,
  createWorkInProgress,
} from './ReactFiber'
import {
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
} from '@my-mini-react/shared/ReactSymbols'
import { isArray } from '@my-mini-react/shared/utils'
import { HostText, Fragment } from './ReactWorkTags'
import { type ReactElement } from '@my-mini-react/shared/ReactTypes'
import type { Lanes } from './ReactFiberLane'

type ChildReconciler = (
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChild: any,
  lanes: Lanes
) => Fiber | null

function createChildReconciler(
  shouldTrackSideEffects: boolean
): ChildReconciler {
  /**
   * 标记删除单个子 Fiber
   *
   * 核心逻辑：
   * 1. 将待删除的 Fiber 添加到父 Fiber 的 deletions 数组中
   * 2. 标记父 Fiber 有 ChildDeletion 副作用
   * 3. 在 commit 阶段会实际执行删除操作
   *
   * 注意：
   * - 只在 update 阶段生效（shouldTrackSideEffects = true）
   * - mount 阶段直接返回，不标记删除
   * - 只是标记删除，不会立即删除，等待 commit 阶段统一处理
   *
   * @param returnFiber 父 Fiber 节点
   * @param childToDelete 待删除的子 Fiber
   */
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      return
    }
    const deletions = returnFiber.deletions
    if (deletions === null) {
      returnFiber.deletions = [childToDelete]
      returnFiber.flags |= ChildDeletion
    } else {
      deletions.push(childToDelete)
    }
  }

  /**
   * 删除剩余的所有子 Fiber
   *
   * 核心逻辑：
   * 1. 从指定的子 Fiber 开始，遍历整个兄弟链表
   * 2. 逐个标记删除每个子 Fiber
   * 3. 返回 null（表示没有新的子节点）
   *
   * 使用场景：
   * - 协调时发现新子节点为空，需要删除所有旧子节点
   * - 找到可复用的节点后，需要删除其后面的兄弟节点
   * - key 匹配但 type 不匹配，需要删除当前节点及其兄弟
   *
   * 注意：
   * - 只在 update 阶段生效（shouldTrackSideEffects = true）
   * - mount 阶段直接返回 null
   * - 只是标记删除，不会立即删除
   *
   * @param returnFiber 父 Fiber 节点
   * @param currentFirstChild 要删除的第一个子 Fiber
   * @returns 始终返回 null
   */
  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null
  ): null {
    if (!shouldTrackSideEffects) {
      return null
    }

    let childToDelete = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling
    }
    return null
  }

  /**
   * 将剩余的旧 Fiber 节点存入 Map
   *
   * 核心功能：
   * - 收集第一阶段未处理的旧 Fiber 节点
   * - 建立 key/index 到 Fiber 的映射，便于第三阶段快速查找复用
   *
   * 映射规则：
   * - 有 key 的节点：使用 key 作为 Map 的键
   * - 无 key 的节点：使用 index 作为 Map 的键
   *
   * 使用场景：
   * - 在 reconcileChildrenArray 的第三阶段（key 匹配）调用
   * - 用于处理节点乱序、新增、删除等复杂情况
   *
   * @param returnFiber 父 Fiber
   * @param currentFirstChild 第一个剩余的旧 Fiber 节点
   * @returns Map<键, Fiber> 键为 string（有 key）或 number（无 key 用 index）
   */
  function mapRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber
  ): Map<string | number, Fiber> {
    const existingChildren: Map<string | number, Fiber> = new Map()

    let existingChild = currentFirstChild
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild)
      } else {
        existingChildren.set(existingChild.index, existingChild)
      }
      existingChild = existingChild.sibling as Fiber
    }
    return existingChildren
  }

  /**
   * 复用现有 Fiber 节点
   *
   * 核心逻辑：
   * 1. 调用 createWorkInProgress 创建（或复用）workInProgress Fiber
   * 2. 重置 index 和 sibling 为初始值
   * 3. 返回复用后的 Fiber
   *
   * 为什么要重置 index 和 sibling？
   * - index: 子节点在兄弟链表中的索引位置，复用时应该重新计算
   * - sibling: 兄弟节点指针，复用时应该清除（由调用方决定是否需要兄弟节点）
   * - 容易忘记重置，所以在这里统一处理
   *
   * 使用场景：
   * - 单个子节点复用时（reconcileSingleElement）
   * - 数组子节点复用时（reconcileChildrenArray）
   * - 任何需要复用旧 Fiber 的场景
   *
   * @param fiber 要复用的旧 Fiber 节点（current 树上的节点）
   * @param pendingProps 新的 props
   * @returns 复用后的 Fiber 节点（workInProgress 树上的节点）
   */
  /**
   * pendingProps 的类型取决于节点的 tag：
   *   tag	            pendingProps 类型	    说明
   *   HostText	        string	             文本内容
   *   HostComponent	  object	             完整的 props
   *   Fragment	        Array	               children 数组
   */
  function useFiber(fiber: Fiber, pendingProps: unknown): Fiber {
    // We currently set sibling to null and index to 0 here because it is easy
    // to forget to do before returning it. E.g. for the single child case.
    // 我们目前在这里将sibling设置为null，将索引设置为0，因为在返回之前很容易忘记这样做。例如，在只有一个孩子的情况下。
    const clone = createWorkInProgress(fiber, pendingProps)
    clone.index = 0
    clone.sibling = null
    return clone
  }

  /**
   * 标记子节点是否需要移动或新增
   *
   * 核心功能：
   * - 决定新 Fiber 是否需要标记 Placement（移动或新增）
   * - 通过 lastPlacedIndex 追踪最后一个放置的位置
   *
   * 判断逻辑：
   * 1. mount 阶段（!shouldTrackSideEffects）：不标记
   * 2. update 阶段：
   *    - 复用了旧 Fiber：
   *      - 旧索引 < lastPlacedIndex → 标记 Placement（需要移动）
   *      - 旧索引 >= lastPlacedIndex → 不标记（不需要移动）
   *    - 新创建 Fiber → 标记 Placement（需要新增）
   *
   * 为什么需要 lastPlacedIndex？
   * - 用于判断节点是否"向后移动"
   * - 如果节点的旧位置在 lastPlacedIndex 之前，说明需要移动
   *
   * @param newFiber 新的 Fiber 节点
   * @param lastPlacedIndex 最后放置的索引（当前最后一位不移动节点的 index。）
   * @param newIndex 新节点的目标索引
   * @returns 更新后的 lastPlacedIndex
   */
  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number
  ): number {
    // 设置新节点的目标索引。
    newFiber.index = newIndex

    // mount 阶段不标记副作用。
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex
    }

    // 获取旧 Fiber（如果复用了）。
    const current = newFiber.alternate
    if (current !== null) {
      // 复用了旧 Fiber。

      // 获取旧节点的索引。
      const oldIndex = current.index
      if (oldIndex < lastPlacedIndex) {
        // 旧索引 < lastPlacedIndex。说明节点需要"向后移动"。

        // 标记 Placement（移动旧 DOM 节点）。
        newFiber.flags |= Placement
        // 不更新 lastPlacedIndex。
        return lastPlacedIndex
      } else {
        // 旧索引 >= lastPlacedIndex。节点不需要移动（自然顺序）。

        // 更新 lastPlacedIndex。
        return oldIndex
      }
    } else {
      // 新创建的 Fiber。新增 DOM 节点。

      // 新节点在 DOM 中不存在，需要插入到正确位置。
      // 标记 Placement（新增 DOM 节点）。
      newFiber.flags |= Placement
      // 不更新 lastPlacedIndex。
      return lastPlacedIndex
    }
  }

  /**
   * 在 update 阶段，React 需要知道哪些 Fiber 是新创建的（需要插入 DOM），哪些是复用的（已存在于 DOM）。
   * placeSingleChild 通过检查 alternate === null 来判断，并标记 Placement 标志。
   */
  function placeSingleChild(newFiber: Fiber): Fiber {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement
    }
    return newFiber
  }

  /**
   * 更新文本节点
   *
   * 核心功能：
   * - 协调文本节点，决定创建新 Fiber 还是复用旧 Fiber
   * - 处理文本内容的更新
   *
   * 处理逻辑：
   * 1. 创建新文本 Fiber：
   *    - 旧节点不存在
   *    - 旧节点不是文本节点
   *
   * 2. 复用旧文本 Fiber：
   *    - 旧节点存在且是文本节点
   *    - 直接更新 pendingProps 为新的文本内容
   *
   * @param returnFiber 父 Fiber
   * @param current 当前 Fiber（旧 Fiber，可能为 null）
   * @param textContent 新的文本内容
   * @param lanes 优先级车道
   * @returns 新的 Fiber 节点
   */
  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string,
    lanes: Lanes
  ): Fiber {
    if (current === null || current.tag !== HostText) {
      // 新节点是文本，但是老节点不是文本或者说老节点不存在。
      const created = createFiberFromText(textContent, returnFiber.mode, lanes)
      created.return = returnFiber
      return created
    } else {
      // 新节点是文本，但是老节点存在且是文本。
      const existing = useFiber(current, textContent)
      existing.return = returnFiber
      return existing
    }
  }

  /**
   * 更新 React 元素节点
   *
   * 核心功能：
   * - 协调 React 元素，决定创建新 Fiber 还是复用旧 Fiber
   * - 特殊处理 Fragment 类型
   * - 处理 ref 的绑定
   *
   * 处理逻辑：
   * 1. Fragment 特殊处理：
   *    - 检测是否为 REACT_FRAGMENT_TYPE
   *    - 调用 updateFragment，传入 element.props.children
   *    - Fragment 不使用 element.props，只使用 children
   *
   * 2. 复用旧 Fiber：
   *    - 旧节点存在且 elementType 匹配
   *    - 复用旧 Fiber，更新 props
   *    - 处理 ref（通过 coerceRef）
   *
   * 3. 创建新 Fiber：
   *    - 旧节点不存在或 elementType 不匹配
   *    - 创建新 Fiber，设置 ref 和 return
   *
   * @param returnFiber 父 Fiber
   * @param current 当前 Fiber（旧 Fiber，可能为 null）
   * @param element React 元素
   * @param lanes 优先级车道
   * @returns 新的 Fiber 节点
   */
  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement,
    lanes: Lanes
  ): Fiber {
    const elementType = element.type
    if (elementType === REACT_FRAGMENT_TYPE) {
      return updateFragment(
        returnFiber,
        current,
        element.props.children,
        lanes,
        element.key
      )
    }
    if (current !== null) {
      if (current.elementType === elementType) {
        const existing = useFiber(current, element.props)
        existing.ref = coerceRef(returnFiber, current, element)
        existing.return = returnFiber
        return existing
      }
    }
    const created = createFiberFromElement(element, returnFiber.mode, lanes)
    created.ref = coerceRef(returnFiber, current, element)
    created.return = returnFiber
    return created
  }

  /**
   * 更新 Fragment 节点
   *
   * 核心功能：
   * - 协调 Fragment 节点，决定创建新 Fiber 还是复用旧 Fiber
   * - 处理 Fragment 的 children 更新
   *
   * Fragment 特点：
   * - 无 DOM 节点（stateNode = null）
   * - 不支持 ref
   * - pendingProps 直接是 children（Iterable）
   * - 可以有 key（显式 Fragment）
   *
   * 处理逻辑：
   * 1. 创建新 Fragment Fiber：
   *    - 旧节点不存在
   *    - 旧节点不是 Fragment
   *
   * 2. 复用旧 Fragment Fiber：
   *    - 旧节点存在且是 Fragment
   *    - 直接更新 pendingProps 为新的 children
   *
   * @param returnFiber 父 Fiber
   * @param current 当前 Fiber（旧 Fiber，可能为 null）
   * @param fragment Fragment 的 children（Iterable 类型）
   * @param lanes 优先级车道
   * @param key Fragment 的 key（可能为 null）
   * @returns 新的 Fiber 节点
   */
  function updateFragment(
    returnFiber: Fiber,
    current: Fiber | null,
    fragment: Iterable<any>,
    lanes: Lanes,
    key: null | string
  ): Fiber {
    if (current === null || current.tag !== Fragment) {
      // Insert
      const created = createFiberFromFragment(
        fragment,
        returnFiber.mode,
        lanes,
        key
      )
      created.return = returnFiber
      return created
    } else {
      // Update
      const existing = useFiber(current, fragment)
      existing.return = returnFiber
      return existing
    }
  }

  /**
   * 创建新的子 Fiber 节点
   *
   * 核心功能：
   * - 根据 newChild 的类型，创建对应的 Fiber 节点
   * - 用于旧节点不存在时的创建场景
   *
   * 处理逻辑：
   * 1. 文本节点：创建文本 Fiber
   * 2. React 元素：创建元素 Fiber，处理 ref
   * 3. 数组：创建 Fragment Fiber
   * 4. 无效对象：抛出错误
   * 5. 其他类型：返回 null（boolean、undefined、null 等）
   *
   * @param returnFiber 父 Fiber
   * @param newChild 新的子节点
   * @param lanes 优先级车道
   * @returns 新创建的 Fiber 节点或 null
   */
  function createChild(
    returnFiber: Fiber,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    // 处理文本节点。
    if (isText(newChild)) {
      const created = createFiberFromText(
        '' + newChild,
        returnFiber.mode,
        lanes
      )
      created.return = returnFiber
      return created
    }

    // 处理对象类型。
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(
            newChild,
            returnFiber.mode,
            lanes
          )
          created.ref = coerceRef(returnFiber, null, newChild)
          created.return = returnFiber
          return created
        }
        // TODO: 待实现。
        // case REACT_PORTAL_TYPE:
        // case REACT_LAZY_TYPE:
      }

      if (isArray(newChild)) {
        const created = createFiberFromFragment(
          newChild,
          returnFiber.mode,
          lanes,
          null
        )
        created.return = returnFiber
        return created
      }

      throwOnInvalidObjectType(returnFiber, newChild)
    }

    // 处理其他类型（boolean、undefined、null 等）。
    return null
  }

  /**
   * 更新单个位置的子节点
   *
   * 核心功能：
   * - 协调单个位置的子节点（第一阶段同位置对比）
   * - 如果 key 匹配，更新或创建 Fiber
   * - 如果 key 不匹配，返回 null
   *
   * 处理逻辑：
   * 1. 获取旧节点的 key
   *    - oldFiber 存在 → 使用 oldFiber.key
   *    - oldFiber 不存在 → key = null
   *
   * 2. 处理文本节点（isText）
   *    - key 不为 null → 不匹配（文本节点没有 key），返回 null
   *    - key 为 null → 调用 updateTextNode
   *
   * 3. 处理 React 元素（REACT_ELEMENT_TYPE）
   *    - newChild.key === key → 调用 updateElement
   *    - newChild.key !== key → 返回 null
   *
   * 4. 处理数组（isArray）
   *    - key 不为 null → 不匹配（数组本身没有 key），返回 null
   *    - key 为 null → 调用 updateFragment（包装成隐式 Fragment）
   *
   * 5. 处理无效对象（throwOnInvalidObjectType）
   *    - 抛出错误：不能直接渲染普通对象
   *
   * 6. 其他情况返回 null
   *    - boolean、undefined、null 等
   *
   * @param returnFiber 父 Fiber
   * @param oldFiber 旧的 Fiber 节点（可能为 null）
   * @param newChild 新的子节点
   * @param lanes 优先级车道
   * @returns 新的 Fiber 节点或 null（不匹配）
   */
  /**
   * // 函数组件返回数组。
   * function MyComponent() {
   *   return [<div key="1">A</div>, <div key="2">B</div>]
   * }
   * // 等价于。
   * function MyComponent() {
   *   return (
   *     <Fragment>
   *       <div key="1">A</div>
   *       <div key="2">B</div>
   *     </Fragment>
   *   )
   * }
   */
  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    // Update the fiber if the keys match, otherwise return null.
    // 如果键匹配，则更新 fiber，否则返回空。

    const key = oldFiber !== null ? oldFiber.key : null

    if (isText(newChild)) {
      if (key !== null) {
        // 新节点是文本，但是老节点存在且不是文本。（因为老节点的 key 存在，而文本节点是没有 key 的。）
        return null
      }
      // 新节点是文本，老节点可能是文本或不存在。
      return updateTextNode(returnFiber, oldFiber, '' + newChild, lanes)
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if (newChild.key === key) {
            return updateElement(returnFiber, oldFiber, newChild, lanes)
          } else {
            return null
          }
        }
        // TODO: 待实现。
        // case REACT_PORTAL_TYPE:
        // case REACT_LAZY_TYPE:
      }

      // 处理数组作为子节点的情况，将其包装成 Fragment。
      if (isArray(newChild)) {
        if (key !== null) {
          // 如果数组且带有 key，说明这不是隐式 Fragment，不匹配，返回 null。
          return null
        }

        return updateFragment(returnFiber, oldFiber, newChild, lanes, null)
      }

      throwOnInvalidObjectType(returnFiber, newChild)
    }

    return null
  }

  /**
   * 从 Map 中查找并更新子节点
   *
   * 核心功能：
   * - 在第三阶段（key 匹配）调用
   * - 通过 key 或 index 从 existingChildren Map 中查找可复用的旧 Fiber
   * - 根据 newChild 类型调用对应的更新方法
   *
   * 查找规则：
   * - 文本节点：没有 key，使用 newIdx 查找
   * - React 元素：有 key 用 key，无 key 用 newIdx
   * - 数组：没有 key，使用 newIdx 查找
   *
   * @param existingChildren 剩余旧节点的 Map（key/index → Fiber）
   * @param returnFiber 父 Fiber
   * @param newIdx 新节点的索引
   * @param newChild 新的子节点
   * @param lanes 优先级车道
   * @returns 新的 Fiber 节点或 null
   */
  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    // 处理文本节点。
    if (isText(newChild)) {
      // Text nodes don't have keys, so we neither have to check the old nor
      // new node for the key. If both are text nodes, they match.
      // 文本节点没有键，所以我们既不需要检查旧节点的键，也不需要检查新节点的键。如果两个节点都是文本节点，那么它们就匹配。
      const matchedFiber = existingChildren.get(newIdx) || null
      return updateTextNode(returnFiber, matchedFiber, '' + newChild, lanes)
    }

    // 处理对象类型。
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key
            ) || null
          return updateElement(returnFiber, matchedFiber, newChild, lanes)
        }
        // TODO: 待实现。
        // case REACT_PORTAL_TYPE:
        // case REACT_LAZY_TYPE:
      }

      if (isArray(newChild)) {
        const matchedFiber = existingChildren.get(newIdx) || null
        return updateFragment(returnFiber, matchedFiber, newChild, lanes, null)
      }

      throwOnInvalidObjectType(returnFiber, newChild)
    }

    // 处理其他类型（boolean、undefined、null 等）。
    return null
  }

  /**
   * 协调子节点数组
   *
   * 核心功能：
   * - 高效对比新旧子节点数组，决定如何复用、创建、删除 Fiber
   * - 实现 React 的 Diff 算法核心逻辑
   *
   * 算法特点：
   * - 由于 Fiber 没有回溯指针，无法从两端优化搜索
   * - 采用单向遍历 + 多路复用的策略
   *
   * 处理流程（三个阶段）：
   * 1. 第一阶段：同位置对比（层级、index 和 key 都相同）
   *    - 遍历新旧节点，尝试在相同位置复用 Fiber
   *    - 遇到不匹配则停止
   *
   * 2. 第二阶段：处理剩余节点
   *    - 情况 A：新节点遍历完，删除剩余旧节点
   *    - 情况 B：旧节点遍历完，创建剩余新节点
   *
   * 3. 第三阶段：多路复用（key 匹配）
   *    - 将剩余旧节点存入 Map（key -> Fiber）
   *    - 遍历剩余新节点，通过 key 查找可复用的旧节点
   *    - 删除未复用的旧节点
   *
   * @param returnFiber 父 Fiber
   * @param currentFirstChild 当前第一个子 Fiber（旧）
   * @param newChildren 新的子节点数组
   * @param lanes 优先级车道
   * @returns 新的第一个子 Fiber
   */
  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<any>,
    lanes: Lanes
  ): Fiber | null {
    // 由于我们在 fiber 上没有回溯指针，所以这个算法无法从两端进行搜索优化。

    // 结果链表的第一个节点。
    let resultingFirstChild: Fiber | null = null
    // 上一轮循环中更新或创建的“新节点”。
    let previousNewFiber: Fiber | null = null

    // 本轮循环中的“旧节点”。
    let oldFiber = currentFirstChild
    // 当前最后一位不需要移动的节点的下标（用于判断“新节点”是否需要移动）。初始值设为 0。
    let lastPlacedIndex = 0
    // 用于标记新节点数组的索引。
    let newIdx = 0
    // 本轮循环中的“下一个旧节点”。
    let nextOldFiber = null

    // 第一阶段：同位置对比。
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      // oldFiber.index > newIdx      有节点被删除
      // oldFiber.index === newIdx    节点顺序正常
      // oldFiber.index < newIdx      不会发生（因为 index 是递增的）
      if (oldFiber.index > newIdx) {
        // 获取下一个旧兄弟节点。
        nextOldFiber = oldFiber
        // 设置本轮循环中的“旧节点”为 null。
        oldFiber = null
      } else {
        // 获取下一个旧兄弟节点。
        nextOldFiber = oldFiber.sibling
      }

      // 尝试更新或创建新节点。
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        newChildren[newIdx],
        lanes
      )
      if (newFiber === null) {
        // 当 updateSlot 返回 null 时，说明无法复用旧 Fiber，需要停止第一阶段的同位置对比。
        // updateSlot 返回 null，说明：
        //   1. 旧节点有 key，新节点是文本；
        //   2. 新旧节点 key 不同；
        //   3. 旧节点有 key，新节点是数组；
        //   4. 新元素是 null/undefined/boolean（空元素）。
        if (oldFiber === null) {
          // 执行到这里说明：newChild 类型是 null/undefined/boolean（空元素）。
          //   此时，将 oldFiber 恢复为之前保存的 nextOldFiber。
          oldFiber = nextOldFiber
        }
        // 停止第一阶段的同位置对比。
        break
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // 复用了旧 Fiber：newFiber.alternate === oldFiber。
          // 创建了新 Fiber：newFiber.alternate === null。
          deleteChild(returnFiber, oldFiber)
        }
      }
      // 标记新 Fiber 是否需要移动或新增，更新 lastPlacedIndex 用于后续新节点的移动判断。
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
      if (previousNewFiber === null) {
        // 保存第一个新节点作为结果链表的头。
        resultingFirstChild = newFiber
      } else {
        // 将新节点连接到前一个新节点的 sibling。
        previousNewFiber.sibling = newFiber
      }
      // 更新前一个新节点的指针（指向当前新节点）。
      previousNewFiber = newFiber
      // 移动到下一个旧节点。
      oldFiber = nextOldFiber
    }

    /**
     * 第二阶段：处理剩余节点。
     */

    // 情况 A：新节点遍历完了，删除剩余的旧节点。
    if (newIdx === newChildren.length) {
      // We've reached the end of the new children. We can delete the rest.
      // 我们已经处理完所有新添加的孩子，可以删除剩余的了。
      deleteRemainingChildren(returnFiber, oldFiber)
      return resultingFirstChild
    }

    // 情况 B：旧节点遍历完了，创建剩余的新节点。
    if (oldFiber === null) {
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      // 如果我们没有更多的现有子节点，我们可以选择一条快速路径，因为剩下的操作都将是插入操作。
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx], lanes)
        if (newFiber === null) {
          continue
        }
        // 在第二阶段，placeChild 的作用是：
        //   标记新 Fiber 为 Placement（新增）；
        //   设置 newFiber.index；
        //   返回 lastPlacedIndex（保持不变）。
        // 因为所有新节点都是新增的，不需要移动判断！
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
      return resultingFirstChild
    }

    /**
     * 第三阶段：多路复用（key 匹配）。
     */

    // Add all children to a key map for quick lookups.
    // 将所有子项添加到键映射中，以便快速查找。
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber)

    // 遍历剩余的新节点，通过 key 查找可复用的旧节点。
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        lanes
      )
      // updateFromMap 返回 null 的情况：newChild 是 undefined、boolean、null 等空值。
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key
            )
          }
        }
        // 在第三阶段，placeChild 的作用是：判断复用的旧 Fiber 是否需要移动；标记需要移动的节点（Placement）；更新 lastPlacedIndex 用于后续节点的移动判断。
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx)
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber
        } else {
          previousNewFiber.sibling = newFiber
        }
        previousNewFiber = newFiber
      }
    }

    if (shouldTrackSideEffects) {
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(child => deleteChild(returnFiber, child))
    }

    return resultingFirstChild
  }

  /**
   * 协调单个文本节点
   *
   * 核心功能：
   * - 协调文本节点，决定创建新 Fiber 还是复用旧 Fiber
   * - 处理文本节点的更新和删除
   *
   * 特点：
   * - 文本节点没有 key，不需要检查 key 匹配
   * - 只需要检查旧节点是否是文本节点（HostText）
   *
   * 处理逻辑：
   * 1. 复用旧文本节点：
   *    - 旧第一个子节点存在且是文本节点
   *    - 删除旧节点的兄弟节点
   *    - 复用旧文本节点，更新文本内容
   *
   * 2. 创建新文本节点：
   *    - 旧第一个子节点不存在或不是文本节点
   *    - 删除所有旧子节点
   *    - 创建新的文本节点
   *
   * @param returnFiber 父 Fiber
   * @param currentFirstChild 当前第一个子 Fiber（旧）
   * @param textContent 新的文本内容
   * @param lanes 优先级车道
   * @returns 新的 Fiber 节点
   */
  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    lanes: Lanes
  ): Fiber {
    // There's no need to check for keys on text nodes since we don't have a
    // way to define them.
    // 由于我们没有定义文本节点上的 keys，所以没有必要检查它们。
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      // We already have an existing node so let's just update it and delete
      // the rest.
      // 我们已经有一个现有的节点，所以只需更新它并删除其余部分。
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling)
      const existing = useFiber(currentFirstChild, textContent)
      existing.return = returnFiber
      return existing
    }
    // The existing first child is not a text node so we need to create one
    // and delete the existing ones.
    // 现有的第一个子节点不是文本节点，因此我们需要创建一个并删除现有的子节点。
    deleteRemainingChildren(returnFiber, currentFirstChild)
    const created = createFiberFromText(textContent, returnFiber.mode, lanes)
    created.return = returnFiber
    return created
  }

  /**
   * 协调单个 React 元素
   *
   * 核心逻辑：
   * 1. 尝试复用现有的 Fiber 节点（key 和 type 都相同）
   * 2. 如果找到可复用的节点，删除其兄弟节点，返回复用节点
   * 3. 如果找不到，删除所有旧节点，创建新 Fiber
   *
   * @param returnFiber 父 Fiber 节点
   * @param currentFirstChild 旧的第一个子 Fiber
   * @param element 新的 React 元素
   * @param lanes 优先级
   * @returns 新的 Fiber 节点（复用或创建）
   */
  /**
   * 节点复用的条件：1. 新旧节点的层级相同 2. 新旧节点 key 相同 3. 新旧节点类型相同。
   * Fragment 是一个"透明"的容器，没有自己的 DOM 节点或组件实例。ref 必须附加到具体的节点或实例上，但 Fragment 两者都没有，所以不支持 ref，也就不需要调用 coerceRef。
   */
  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    lanes: Lanes
  ): Fiber {
    // 获取新元素的 key。
    const key = element.key
    let child = currentFirstChild

    // 第一步：尝试复用旧 Fiber。
    while (child !== null) {
      // 检查 key 是否匹配。
      if (child.key === key) {
        // key 匹配，检查类型是否匹配。
        const elementType = element.type

        if (elementType === REACT_FRAGMENT_TYPE) {
          // Fragment 类型特殊处理。
          if (child.tag === Fragment) {
            // 类型匹配，可以复用。
            // 删除 child 后面的所有兄弟节点（因为新元素只有一个子节点）。
            deleteRemainingChildren(returnFiber, child.sibling)

            // 复用当前 Fiber，更新 props。
            const existing = useFiber(child, element.props.children)
            existing.return = returnFiber
            // 返回复用节点。
            return existing
          }
        } else {
          // 非 Fragment 类型。
          if (child.elementType === elementType) {
            // 类型匹配，可以复用。
            // 删除 child 后面的所有兄弟节点。
            deleteRemainingChildren(returnFiber, child.sibling)

            // 复用当前 Fiber，更新 props。
            const existing = useFiber(child, element.props)
            // 更新 ref。
            existing.ref = coerceRef(returnFiber, child, element)
            existing.return = returnFiber
            // 返回复用节点。
            return existing
          }
        }

        // key 匹配但类型不匹配。
        // 删除当前节点及其后面的所有兄弟节点。
        deleteRemainingChildren(returnFiber, child)
        // 退出循环。
        break
      } else {
        // key 不匹配。
        // 删除当前节点。
        deleteChild(returnFiber, child)
      }
      // 继续检查下一个兄弟节点。
      child = child.sibling
    }

    // 第二步：创建新 Fiber。
    // 执行到这里说明没有找到可复用的节点。
    if (element.type === REACT_FRAGMENT_TYPE) {
      // 创建 Fragment Fiber。
      const created = createFiberFromFragment(
        element.props.children,
        returnFiber.mode,
        lanes,
        element.key
      )
      created.return = returnFiber
      // 返回新创建的节点。
      return created
    } else {
      // 创建普通元素 Fiber。
      const created = createFiberFromElement(element, returnFiber.mode, lanes)
      // 设置 ref。
      created.ref = coerceRef(returnFiber, currentFirstChild, element)
      created.return = returnFiber
      // 返回新创建的节点。
      return created
    }
  }

  /**
   * 协调子节点 Fiber
   *
   * 核心功能：
   * - React 子节点协调的入口函数
   * - 根据 newChild 的类型，分发到不同的协调逻辑
   * - 决定创建新 Fiber、复用旧 Fiber 或删除旧 Fiber
   *
   * 处理流程：
   * 1. 处理顶层无 key 的 Fragment（穿透优化）
   *    - 检测是否为顶层无 key Fragment
   *    - 直接提取 children，跳过 Fragment 节点
   *
   * 2. 处理 React 元素（REACT_ELEMENT_TYPE）
   *    - 调用 reconcileSingleElement
   *    - 标记 Placement（如果是新创建）
   *
   * 3. 处理数组（isArray）
   *    - 调用 reconcileChildrenArray
   *    - 实现 Diff 算法（同位置对比 + key 匹配）
   *
   * 4. 处理文本节点（isText）
   *    - 调用 reconcileSingleTextNode
   *    - 标记 Placement（如果是新创建）
   *
   * 5. 处理无效对象（throwOnInvalidObjectType）
   *    - 抛出错误：不能直接渲染普通对象
   *
   * 6. 处理空节点（deleteRemainingChildren）
   *    - newChild 是 boolean、undefined、null 等
   *    - 删除所有旧子节点
   *
   * @param returnFiber 父 Fiber
   * @param currentFirstChild 当前第一个子 Fiber（旧）
   * @param newChild 新的子节点
   * @param lanes 优先级车道
   * @returns 新的第一个子 Fiber 或 null
   */
  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    lanes: Lanes
  ): Fiber | null {
    // 什么是顶层无 key 的 Fragment？
    //   function Parent() {
    //     return (
    //       <>  {/* ← 顶层 Fragment */}
    //         <Child1 />
    //         <Child2 />
    //       </>
    //     )
    //   }
    // 顶层无 key 的 Fragment 只是一个语法糖，不需要在 Fiber 树中占据一个节点。
    //   React 直接提取其 children 进行协调，可以减少一层 Fiber，提高性能。
    //   如果你写了 <><Child1 /><Child2 /></>，React 会把它当成直接写 <Child1 /><Child2 /> 来处理，跳过 Fragment 本身。
    const isUnkeyedTopLevelFragment =
      typeof newChild === 'object' &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null
    if (isUnkeyedTopLevelFragment) {
      newChild = newChild.props.children
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            )
          )
        // TODO: 待实现。
        // case REACT_PORTAL_TYPE:
        // case REACT_LAZY_TYPE:
      }

      if (isArray(newChild)) {
        return reconcileChildrenArray(
          returnFiber,
          currentFirstChild,
          newChild,
          lanes
        )
      }

      // TODO: 待实现。
      // if (getIteratorFn(newChild)) {}

      // 当 newChild 是对象类型，但不是 React 元素、Portal、Lazy 组件、数组或可迭代对象时，抛出错误。
      throwOnInvalidObjectType(returnFiber, newChild)
    }

    if (isText(newChild)) {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          '' + newChild,
          lanes
        )
      )
    }

    // Remaining cases are all treated as empty.
    // 如果 newChild 是其他类型（如 boolean、undefined、function 等），直接标记删除 currentFirstChild 及其后续节点。
    return deleteRemainingChildren(returnFiber, currentFirstChild)
  }

  return reconcileChildFibers
}

export const reconcileChildFibers = createChildReconciler(true)
export const mountChildFibers = createChildReconciler(false)

function isText(newChild: any): boolean {
  return (
    (typeof newChild === 'string' && newChild !== '') ||
    typeof newChild === 'number'
  )
}

/**
 * 抛出无效对象类型错误
 *
 * 核心功能：
 * - 检测并报错：不能直接渲染普通对象
 * - 提供友好的错误信息，帮助开发者定位问题
 *
 * 错误场景：
 * - 直接渲染对象：return { name: 'John', age: 30 }
 * - 忘记使用数组：return { 0: <div>A</div>, 1: <div>B</div> }
 * - 误将对象作为子节点：<div>{user}</div>
 *
 * 错误信息：
 * - 如果是普通对象：显示对象的 keys
 * - 如果是其他类型：显示 toString 结果
 * - 提示使用数组渲染集合
 *
 * @param returnFiber 父 Fiber
 * @param newChild 无效的子节点（对象类型）
 */
function throwOnInvalidObjectType(returnFiber: Fiber, newChild: Object): void {
  const childString = Object.prototype.toString.call(newChild)

  throw new Error(
    `Objects are not valid as a React child (found: ${
      childString === '[object Object]'
        ? 'object with keys {' + Object.keys(newChild).join(', ') + '}'
        : childString
    }). ` +
      'If you meant to render a collection of children, use an array ' +
      'instead.'
  )
}

/**
 * 处理并返回 ref
 *
 * 核心功能：
 * - 简单返回元素的 ref
 *
 * 注意：
 * - React 18+ 推荐使用回调 ref 或 createRef
 * - 字符串 ref 已被废弃，不再提供支持
 *
 * 支持的 ref 类型：
 * 1. 回调 ref: ref={(el) => this.myRef = el}
 * 2. createRef 对象: ref={React.createRef()}
 * 3. useRef 对象: ref={useRef(null)}
 *
 * @param returnFiber 父 Fiber
 * @param current 当前 Fiber（旧 Fiber，用于复用）
 * @param element React 元素
 * @returns 原始 ref（回调函数或 ref 对象）
 */
function coerceRef(
  returnFiber: Fiber,
  current: Fiber | null,
  element: ReactElement
): any {
  const mixedRef = element.ref
  return mixedRef
}

/**
 * 克隆子 Fiber 节点
 *
 * 核心作用：
 * 在 bailout 场景下，将 current 的子 Fiber 克隆到 workInProgress 树中，
 * 以便继续协调子节点的工作，而不需要重新执行 Diff 算法。
 *
 * 使用场景：
 * - bailoutOnAlreadyFinishedWork 中，当前节点不需要更新但子节点需要
 * - 避免重新执行 reconcileChildren 的 Diff 算法
 * - 快速复制现有的子 Fiber 结构
 *
 * 注意事项：
 * - 不执行 Diff，只是浅拷贝
 * - 要求 workInProgress.child 必须等于 current.child
 * - 只克隆，不创建新的子元素
 *
 * @param current - 上一次的 Fiber 节点（双缓冲的旧节点）
 * @param workInProgress - 当前正在构建的 Fiber 节点，其子节点将被克隆
 */
export function cloneChildFibers(
  current: Fiber | null,
  workInProgress: Fiber
): void {
  if (current !== null && workInProgress.child !== current.child) {
    throw new Error('Resuming work not yet implemented.')
  }

  if (workInProgress.child === null) {
    return
  }

  let currentChild = workInProgress.child
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps)
  workInProgress.child = newChild
  newChild.return = workInProgress

  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps
    )
    newChild.return = workInProgress
  }
  newChild.sibling = null
}
