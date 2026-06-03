import * as React from 'react';
import type { Track } from 'livekit-client';
import { useSize } from './hooks';

const LAYOUT_GAP = 4;
// focus 布局下主区和缩略区的尺寸比例，分别适配 desktop 和 mobile 两种使用场景
const DESKTOP_FOCUS_RAIL_RATIO = 0.24;
const MOBILE_FOCUS_MAIN_RATIO = 0.72;

/**
 * 布局引擎依赖的最小实体抽象。
 *
 * 这个接口只要求一个稳定 id，确保布局库可以脱离 LiveKit 独立存在。
 * 如果业务层还需要保留原始对象，可以放在 payload 中回传给渲染层使用。
 */
export interface LayoutEntity<TPayload = unknown> {
  // 稳定且唯一的实体标识。布局层只依赖这个字段判断节点身份。
  id: string;
  // 可选的实体类型信息，给上层做样式或策略分流使用。
  type?: string;
  // 可选的实体分组信息，例如 participant、widget、screen-share。
  category?: string;
  // 可选的来源信息，例如 camera、screen_share、microphone。
  source?: string;
  // 可选的业务标签，方便上层做筛选和调试。
  label?: string;
  // 原始业务对象。布局引擎不依赖它，只透传给渲染层。
  payload?: TPayload;
}

export interface LayoutNode<TEntity extends LayoutEntity = LayoutEntity> {
  // 当前布局节点对应的布局实体，外部渲染层可以基于它找到对应的 Tile 宿主。
  entity: TEntity;
  // 节点左上角在布局舞台中的 x 坐标。
  x: number;
  // 节点左上角在布局舞台中的 y 坐标。
  y: number;
  // 节点目标宽度。
  width: number;
  // 节点目标高度。
  height: number;
  // 节点所属区域，用于外部渲染层区分主区、缩略区和普通网格区。
  area: 'grid' | 'main' | 'rail';
  // 当前节点归属的页码。focus 布局下主节点和 rail 节点会共享同一页码。
  page: number;
  // 是否为当前焦点节点。外部可以用它决定是否高亮、置顶或绑定特殊交互。
  isFocus: boolean;
  // 渲染层级，便于后续做 transform 过渡时保持主节点始终覆盖缩略区。
  zIndex: number;
}

// 兼容旧命名，避免当前工程一次性改太多调用点。
export type LayoutTrack<TPayload = unknown> = LayoutEntity<TPayload>;
export type LayoutTrackNode<TEntity extends LayoutEntity = LayoutEntity> = LayoutNode<TEntity>;

export interface UnifiedLayoutRenderState<TEntity extends LayoutEntity = LayoutEntity> {
  entity: TEntity;
  node: LayoutNode<TEntity> | null;
  isVisible: boolean;
  isFocus: boolean;
  area: LayoutNode['area'] | 'hidden';
}

export interface UnifiedLayoutState<TEntity extends LayoutEntity = LayoutEntity> {
  nodes: LayoutNode<TEntity>[];
  currentPage: number;
  totalPages: number;
  layoutType: 'grid' | 'focus';
  width: number;
  height: number;
  focusEntity: TEntity | null;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export interface UnifiedLayoutProps<TEntity extends LayoutEntity = LayoutEntity>
  extends React.HTMLAttributes<HTMLDivElement> {
  entities: TEntity[];
  focusEntity?: TEntity | null;
  layoutType?: 'grid' | 'focus';
  deviceType?: 'mobile' | 'desktop';
  fullScreen?: boolean;
  page?: number;
  defaultPage?: number;
  pageSize?: number;
  preserveOffscreen?: boolean;
  hiddenScale?: number;
  enableFlip?: boolean;
  transitionDuration?: number;
  transitionEasing?: string;
  renderEntity: (
    entity: TEntity,
    state: UnifiedLayoutRenderState<TEntity>,
  ) => React.ReactNode;
  renderOverlay?: (state: UnifiedLayoutState<TEntity>) => React.ReactNode;
  renderEmpty?: React.ReactNode | (() => React.ReactNode);
  onPageChange?: (page: number) => void;
  onNodesChange?: (nodes: LayoutNode<TEntity>[]) => void;
}

/**
 * # LayoutComputer
 * 负责根据当前的 entities、focusEntity、分页状态、设备类型等信息，计算出每个实体的布局位置和大小。
 * 计算出的布局会存储在 this.layoutNodes 中，供后续渲染使用。
 *
 * 这个类只做纯布局计算，不依赖 React，也不依赖 LiveKit。
 */
export class LayoutComputer<TEntity extends LayoutEntity = LayoutEntity> {
  // 所有的布局实体。
  protected entities: TEntity[];
  // 当前被选中的布局实体，如果有选中（切换）则会转为 focus 布局。
  protected focusEntity: TEntity | null = null;
  // 设备类型
  deviceType: 'mobile' | 'desktop' = 'desktop';
  // 分页状态 ---------------------------------------
  // 当前页码
  page: number = 1;
  // 每页显示的实体数量
  pageSize: number = 4;
  // 是否全屏显示
  fullScreen: boolean = false;
  // 外部容器宽高
  height: number = 0;
  width: number = 0;
  // 计算出的布局节点
  private layoutNodes: LayoutNode<TEntity>[] = [];
  // 当前布局类型，默认为 grid
  layoutType: 'grid' | 'focus' = 'grid';

  constructor(entities: TEntity[], height: number, width: number) {
    this.entities = entities;
    this.height = height;
    this.width = width;
  }

  /**
   * 根据当前状态生成一份最新布局结果。
   *
   * 计算顺序如下：
   * 1. 先校验容器尺寸和实体集合是否有效。
   * 2. 再校验 focusEntity 是否仍存在于当前 entities 中，不存在就自动回退为 grid。
   * 3. 如果处于 fullScreen，则只输出一个覆盖整个容器的 main 节点。
   * 4. 否则根据 layoutType 进入 grid 或 focus 计算。
   *
   * 返回值会同时写入内部缓存，渲染层可通过 getLayoutNodes() 重复读取。
   */
  computeLayout() {
    const activeFocusEntity = this.resolveFocusEntity();

    if (this.width <= 0 || this.height <= 0 || this.entities.length === 0) {
      this.layoutNodes = [];
      return this.layoutNodes;
    }

    if (this.fullScreen) {
      const fullScreenEntity =
        activeFocusEntity ?? this.getEntitiesForCurrentPage(this.entities, 1)[0] ?? this.entities[0];
      this.layoutNodes = fullScreenEntity
        ? [
            {
              entity: fullScreenEntity,
              x: 0,
              y: 0,
              width: this.width,
              height: this.height,
              area: 'main',
              page: 1,
              isFocus: true,
              zIndex: 2,
            },
          ]
        : [];
      return this.layoutNodes;
    }

    const computedNodes =
      this.layoutType === 'focus' && activeFocusEntity
        ? this.computeFocusLayout(activeFocusEntity)
        : this.computeGridLayout();

    this.layoutNodes = computedNodes;
    return this.layoutNodes;
  }

  setPage(page: number) {
    const totalPages = this.totalPages();
    if (page >= 1 && page <= totalPages) {
      this.page = page;
    }
  }

  /**
   * 计算总页数。
   *
   * 这里至少返回 1，目的是让分页状态始终有一个稳定值，
   * 即使当前没有实体，外部也不需要处理 0 页这种特殊分支。
   */
  totalPages() {
    if (this.fullScreen) {
      return 1;
    }

    const activeFocusEntity = this.layoutType === 'focus' ? this.resolveFocusEntity() : null;
    const pagedEntityCount = activeFocusEntity
      ? this.entities.filter((entity) => !this.isSameEntity(entity, activeFocusEntity)).length
      : this.entities.length;

    return Math.max(1, Math.ceil(pagedEntityCount / this.pageSize));
  }

  nextPage() {
    const totalPages = this.totalPages();
    if (this.page < totalPages) {
      this.page += 1;
    }
  }

  prevPage() {
    if (this.page > 1) {
      this.page -= 1;
    }
  }

  /**
   * 只设置 focusEntity，不切换布局。
   */
  setFocusEntity(entity: TEntity | null) {
    this.focusEntity = entity;
  }

  // 兼容旧命名。
  setFocusTrack(entity: TEntity | null) {
    this.setFocusEntity(entity);
  }

  /**
   * 切换布局类型，如果当前是 grid 则切换到 focus，如果当前是 focus 则切换到 grid。
   *
   * 注意：切换到 focus 布局时，如果没有 focusEntity 则不切换布局，保持在 grid 布局。
   */
  switchLayout() {
    if (!this.resolveFocusEntity()) return;
    this.layoutType = this.layoutType === 'grid' ? 'focus' : 'grid';
  }

  /**
   * 设置并切换到 focus 布局，如果传入了 entity 则同时设置 focusEntity，否则保持原有 focusEntity 不变。
   */
  setAndSwitchFocus(entity?: TEntity) {
    if (entity) {
      this.focusEntity = entity;
    }
    if (!this.resolveFocusEntity()) return;
    this.layoutType = 'focus';
  }

  // 兼容旧命名。
  setAndSwitchFocusTrack(entity?: TEntity) {
    this.setAndSwitchFocus(entity);
  }

  setEntities(entities: TEntity[]) {
    this.entities = entities;
    this.page = Math.min(this.page, this.totalPages());
    if (this.focusEntity && !this.resolveFocusEntity()) {
      this.layoutType = 'grid';
    }
  }

  // 兼容旧命名。
  setTracks(entities: TEntity[]) {
    this.setEntities(entities);
  }

  setDeviceType(deviceType: 'mobile' | 'desktop') {
    this.deviceType = deviceType;
  }

  /**
   * 设置每页展示数量。
   *
   * 这里同时会修正当前 page，避免 pageSize 变更后页码落到范围外。
   */
  setPageSize(pageSize: number) {
    if (pageSize < 1) return;
    this.pageSize = Math.floor(pageSize);
    this.page = Math.min(this.page, this.totalPages());
  }

  /**
   * 手动设置当前布局模式。
   *
   * 当外部尝试切到 focus，但当前没有合法 focusEntity 时，
   * 这里会安全回退到 grid，避免得到一份不完整的布局结果。
   */
  setLayoutType(layoutType: 'grid' | 'focus') {
    if (layoutType === 'focus' && !this.resolveFocusEntity()) {
      this.layoutType = 'grid';
      return;
    }
    this.layoutType = layoutType;
  }

  setHeight(height: number) {
    this.height = height;
  }

  setWidth(width: number) {
    this.width = width;
  }

  setSize(height: number, width: number) {
    this.height = height;
    this.width = width;
  }

  setIsFullScreen(fullScreen: boolean) {
    this.fullScreen = fullScreen;
  }

  getFocusEntity(): TEntity | null {
    return this.focusEntity;
  }

  // 兼容旧命名。
  getFocusTrack(): TEntity | null {
    return this.getFocusEntity();
  }

  getEntities(): TEntity[] {
    return this.entities;
  }

  // 兼容旧命名。
  getTracks(): TEntity[] {
    return this.getEntities();
  }

  getLayoutNodes(): LayoutNode<TEntity>[] {
    return [...this.layoutNodes];
  }

  getLayoutType(): 'grid' | 'focus' {
    return this.layoutType;
  }

  /**
   * 计算标准网格布局。
   *
   * 仅对当前页的实体进行排布，每个节点都会被映射到统一大小的网格单元中。
   * 网格的行列数会根据设备类型和容器比例做一个尽量接近方阵的估算。
   */
  private computeGridLayout(): LayoutNode<TEntity>[] {
    const pageEntities = this.getEntitiesForCurrentPage(this.entities, this.pageSize);
    const { columns, rows } = this.resolveGridDimensions(pageEntities.length);
    const cellWidth = this.resolveCellSize(this.width, columns);
    const cellHeight = this.resolveCellSize(this.height, rows);

    return pageEntities.map((entity, index) => {
      const columnIndex = index % columns;
      const rowIndex = Math.floor(index / columns);

      return {
        entity,
        x: columnIndex * (cellWidth + LAYOUT_GAP),
        y: rowIndex * (cellHeight + LAYOUT_GAP),
        width: cellWidth,
        height: cellHeight,
        area: 'grid',
        page: this.page,
        isFocus: false,
        zIndex: 1,
      };
    });
  }

  /**
   * 计算 focus 布局。
   *
   * 规则是：
   * 1. focusEntity 永远作为 main 区输出。
   * 2. 其余实体进入 rail 区，并参与单独分页。
   * 3. desktop 采用左 rail 右 main。
   * 4. mobile 采用上 main 下 rail。
   */
  private computeFocusLayout(focusEntity: TEntity): LayoutNode<TEntity>[] {
    const restEntities = this.entities.filter((entity) => !this.isSameEntity(entity, focusEntity));
    const visibleRailEntities = this.getEntitiesForCurrentPage(restEntities, this.pageSize);

    if (visibleRailEntities.length === 0) {
      return [
        {
          entity: focusEntity,
          x: 0,
          y: 0,
          width: this.width,
          height: this.height,
          area: 'main',
          page: 1,
          isFocus: true,
          zIndex: 2,
        },
      ];
    }

    return this.deviceType === 'mobile'
      ? this.computeMobileFocusLayout(focusEntity, visibleRailEntities)
      : this.computeDesktopFocusLayout(focusEntity, visibleRailEntities);
  }

  /**
   * 桌面端 focus 布局。
   *
   * 主区在右侧，占据绝大多数宽度；其余节点在左侧垂直排列。
   * 这和当前项目既有的 focus + carousel 使用习惯更接近，后续也更容易接 transform 过渡。
   */
  private computeDesktopFocusLayout(
    focusEntity: TEntity,
    railEntities: TEntity[],
  ): LayoutNode<TEntity>[] {
    const railWidth = Math.min(Math.max(this.width * DESKTOP_FOCUS_RAIL_RATIO, 180), 320);
    const mainWidth = Math.max(this.width - railWidth - LAYOUT_GAP, 0);
    const railItemHeight = this.resolveCellSize(this.height, railEntities.length);
    const railNodes = railEntities.map((entity, index) => ({
      entity,
      x: 0,
      y: index * (railItemHeight + LAYOUT_GAP),
      width: railWidth,
      height: railItemHeight,
      area: 'rail' as const,
      page: this.page,
      isFocus: false,
      zIndex: 1,
    }));

    return [
      {
        entity: focusEntity,
        x: railWidth + LAYOUT_GAP,
        y: 0,
        width: mainWidth,
        height: this.height,
        area: 'main',
        page: this.page,
        isFocus: true,
        zIndex: 2,
      },
      ...railNodes,
    ];
  }

  /**
   * 移动端 focus 布局。
   *
   * 移动端优先保证主区的可视面积，因此让 main 节点占据上方大部分高度，
   * rail 节点缩成底部横向条带，便于后续做滑动切换或分页指示。
   */
  private computeMobileFocusLayout(
    focusEntity: TEntity,
    railEntities: TEntity[],
  ): LayoutNode<TEntity>[] {
    const mainHeight = Math.max(this.height * MOBILE_FOCUS_MAIN_RATIO, 0);
    const railHeight = Math.max(this.height - mainHeight - LAYOUT_GAP, 0);
    const railItemWidth = this.resolveCellSize(this.width, railEntities.length);
    const railNodes = railEntities.map((entity, index) => ({
      entity,
      x: index * (railItemWidth + LAYOUT_GAP),
      y: mainHeight + LAYOUT_GAP,
      width: railItemWidth,
      height: railHeight,
      area: 'rail' as const,
      page: this.page,
      isFocus: false,
      zIndex: 1,
    }));

    return [
      {
        entity: focusEntity,
        x: 0,
        y: 0,
        width: this.width,
        height: mainHeight,
        area: 'main',
        page: this.page,
        isFocus: true,
        zIndex: 2,
      },
      ...railNodes,
    ];
  }

  /**
   * 校验并返回当前可用的 focusEntity。
   */
  private resolveFocusEntity() {
    const currentFocusEntity = this.focusEntity;

    if (!currentFocusEntity) {
      return null;
    }

    const matchedEntity = this.entities.find((entity) => this.isSameEntity(entity, currentFocusEntity));
    if (!matchedEntity) {
      this.focusEntity = null;
      return null;
    }

    this.focusEntity = matchedEntity;
    return matchedEntity;
  }

  /**
   * 根据当前 page 对传入的实体集合做分页切片。
   */
  private getEntitiesForCurrentPage(entities: TEntity[], pageSize: number) {
    if (entities.length === 0) {
      this.page = 1;
      return [];
    }

    const totalPages = Math.max(1, Math.ceil(entities.length / pageSize));
    this.page = Math.min(Math.max(this.page, 1), totalPages);

    const startIndex = (this.page - 1) * pageSize;
    return entities.slice(startIndex, startIndex + pageSize);
  }

  /**
   * 推导 grid 布局的行列数。
   *
   * mobile 端优先给出更稳定的固定排列，减少频繁横竖切换时的视觉跳变；
   * desktop 端则按容器宽高比估算一个尽量均衡的列数。
   */
  private resolveGridDimensions(entityCount: number) {
    if (entityCount <= 1) {
      return { columns: 1, rows: 1 };
    }

    if (this.deviceType === 'mobile') {
      const isPortrait = this.height >= this.width;
      if (entityCount === 2) {
        return isPortrait ? { columns: 1, rows: 2 } : { columns: 2, rows: 1 };
      }

      if (entityCount <= 4) {
        return { columns: 2, rows: 2 };
      }
    }

    const containerAspect = this.width / Math.max(this.height, 1);
    const columns = Math.max(1, Math.ceil(Math.sqrt(entityCount * containerAspect)));
    const rows = Math.max(1, Math.ceil(entityCount / columns));

    return { columns, rows };
  }

  /**
   * 计算单个网格单元在指定轴上的尺寸。
   *
   * 会自动扣除 gap 的占用，保证最终节点总尺寸不会超出容器边界。
   */
  private resolveCellSize(totalSize: number, divisions: number) {
    if (divisions <= 1) {
      return totalSize;
    }

    return Math.max((totalSize - LAYOUT_GAP * (divisions - 1)) / divisions, 0);
  }

  /**
   * 判断两个实体是否可以视为同一个布局节点。
   */
  private isSameEntity(leftEntity: TEntity, rightEntity: TEntity) {
    return leftEntity === rightEntity || leftEntity.id === rightEntity.id;
  }
}

/**
 * LiveKit Track 到最小布局实体的适配器。
 *
 * 适配后的对象只暴露布局层关心的稳定 id，同时把原始 Track 放在 payload 里，
 * 便于现有 React 渲染层继续取回 LiveKit 对象。
 */
export function createLayoutEntityFromLiveKitTrack(track: Track): LayoutEntity<Track> {
  return {
    id: track.sid || `${track.kind}_${track.source}_${track.mediaStreamID}`,
    type: track.kind,
    category: 'track',
    source: track.source,
    label: `${track.kind}:${track.source}`,
    payload: track,
  };
}

// 兼容旧命名。
export const createLayoutTrackFromLiveKitTrack = createLayoutEntityFromLiveKitTrack;

export interface UseReplaceLivekitTrackOptions<
  TTrack,
  TEntity extends LayoutEntity = LayoutEntity<TTrack>,
> {
  tracks: TTrack[];
  focusTrack?: TTrack | null;
  getTrackId: (track: TTrack) => string | undefined;
  mapTrackToEntity?: (track: TTrack, id: string) => TEntity;
  appendFocusTrack?: boolean;
}

export interface UseReplaceLivekitTrackResult<
  TTrack,
  TEntity extends LayoutEntity = LayoutEntity<TTrack>,
> {
  entities: TEntity[];
  focusEntity: TEntity | null;
}

/**
 * 把 LiveKit 风格的 track 输入替换成布局层可消费的 LayoutEntity。
 *
 * 这个 hook 不要求具体类型一定来自 LiveKit，只要求外部能提供稳定 id 提取函数。
 * 当 focusTrack 不在 tracks 列表中时，也可以选择追加进去，以适配被 pin 的 placeholder 场景。
 */
export function useReplaceLivekitTrack<TTrack, TEntity extends LayoutEntity = LayoutEntity<TTrack>>({
  tracks,
  focusTrack = null,
  getTrackId,
  mapTrackToEntity,
  appendFocusTrack = true,
}: UseReplaceLivekitTrackOptions<TTrack, TEntity>): UseReplaceLivekitTrackResult<TTrack, TEntity> {
  return React.useMemo(() => {
    const toEntity = (track: TTrack, id: string) => {
      if (mapTrackToEntity) {
        return mapTrackToEntity(track, id);
      }

      return {
        id,
        category: 'track',
        payload: track,
      } as TEntity;
    };

    const entityMap = new Map<string, TEntity>();

    tracks.forEach((track) => {
      const id = getTrackId(track);
      if (!id || entityMap.has(id)) return;
      entityMap.set(id, toEntity(track, id));
    });

    let focusEntity: TEntity | null = null;
    if (focusTrack) {
      const focusId = getTrackId(focusTrack);
      if (focusId) {
        focusEntity = entityMap.get(focusId) ?? toEntity(focusTrack, focusId);
        if (appendFocusTrack && !entityMap.has(focusId)) {
          entityMap.set(focusId, focusEntity);
        }
      }
    }

    return {
      entities: Array.from(entityMap.values()),
      focusEntity,
    };
  }, [appendFocusTrack, focusTrack, getTrackId, mapTrackToEntity, tracks]);
}

const DEFAULT_TRANSITION_DURATION = 240;
const DEFAULT_TRANSITION_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const DEFAULT_HIDDEN_SCALE = 0.96;

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function resolveEmptyRenderer(renderEmpty?: React.ReactNode | (() => React.ReactNode)) {
  if (typeof renderEmpty === 'function') {
    return renderEmpty();
  }
  return renderEmpty ?? null;
}

function buildEntityStyle<TEntity extends LayoutEntity>(
  node: LayoutNode<TEntity> | null,
  options: {
    width: number;
    height: number;
    hiddenScale: number;
    enableFlip: boolean;
    transitionDuration: number;
    transitionEasing: string;
  },
): React.CSSProperties {
  const {
    width,
    height,
    hiddenScale,
    enableFlip,
    transitionDuration,
    transitionEasing,
  } = options;
  const hiddenOffsetX = Math.max(width + LAYOUT_GAP * 2, 64);
  const hiddenOffsetY = Math.max(height + LAYOUT_GAP * 2, 64);
  const translateX = node?.x ?? hiddenOffsetX;
  const translateY = node?.y ?? hiddenOffsetY;
  const scale = node ? 1 : hiddenScale;

  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: node?.width ?? Math.max(width * 0.18, 80),
    height: node?.height ?? Math.max(height * 0.18, 60),
    transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
    transformOrigin: 'top left',
    opacity: node ? 1 : 0,
    zIndex: node?.zIndex ?? 0,
    pointerEvents: node ? 'auto' : 'none',
    transition: enableFlip
      ? `opacity ${transitionDuration}ms ${transitionEasing}`
      : [
          `transform ${transitionDuration}ms ${transitionEasing}`,
          `width ${transitionDuration}ms ${transitionEasing}`,
          `height ${transitionDuration}ms ${transitionEasing}`,
          `opacity ${transitionDuration}ms ${transitionEasing}`,
        ].join(', '),
    willChange: 'transform, width, height, opacity',
  };
}

export function UnifiedLayout<TEntity extends LayoutEntity = LayoutEntity>({
  entities,
  focusEntity = null,
  layoutType,
  deviceType = 'desktop',
  fullScreen = false,
  page,
  defaultPage = 1,
  pageSize = 4,
  preserveOffscreen = true,
  hiddenScale = DEFAULT_HIDDEN_SCALE,
  enableFlip = true,
  transitionDuration = DEFAULT_TRANSITION_DURATION,
  transitionEasing = DEFAULT_TRANSITION_EASING,
  renderEntity,
  renderOverlay,
  renderEmpty,
  onPageChange,
  onNodesChange,
  className,
  style,
  ...props
}: UnifiedLayoutProps<TEntity>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const entityElementRefs = React.useRef(new Map<string, HTMLDivElement>());
  const previousRectSnapshots = React.useRef(
    new Map<string, { rect: DOMRect; visible: boolean }>(),
  );
  const activeAnimations = React.useRef(new Map<string, Animation>());
  const { width, height } = useSize(containerRef);
  const isControlledPage = typeof page === 'number';
  const [internalPage, setInternalPage] = React.useState(defaultPage);
  const currentPage = isControlledPage ? page : internalPage;

  const computedLayout = React.useMemo(() => {
    const computer = new LayoutComputer(entities, height, width);
    computer.setDeviceType(deviceType);
    computer.setFocusEntity(focusEntity);
    computer.setLayoutType(layoutType ?? (focusEntity ? 'focus' : 'grid'));
    computer.setIsFullScreen(fullScreen);
    computer.setPageSize(pageSize);

    const totalPages = computer.totalPages();
    const resolvedPage = clampPage(currentPage, totalPages);
    computer.setPage(resolvedPage);

    const nodes = computer.computeLayout();

    return {
      nodes,
      totalPages: computer.totalPages(),
      currentPage: computer.page,
      layoutType: computer.getLayoutType(),
      focusEntity: computer.getFocusEntity(),
    };
  }, [currentPage, deviceType, entities, focusEntity, fullScreen, height, layoutType, pageSize, width]);

  const setPage = React.useCallback(
    (nextPage: number) => {
      const resolvedPage = clampPage(nextPage, computedLayout.totalPages);
      if (!isControlledPage) {
        setInternalPage((prevPage) => (prevPage === resolvedPage ? prevPage : resolvedPage));
      }
      if (resolvedPage !== currentPage) {
        onPageChange?.(resolvedPage);
      }
    },
    [computedLayout.totalPages, currentPage, isControlledPage, onPageChange],
  );

  const nextPage = React.useCallback(() => {
    setPage(currentPage + 1);
  }, [currentPage, setPage]);

  const prevPage = React.useCallback(() => {
    setPage(currentPage - 1);
  }, [currentPage, setPage]);

  React.useEffect(() => {
    if (computedLayout.currentPage !== currentPage) {
      setPage(computedLayout.currentPage);
    }
  }, [computedLayout.currentPage, currentPage, setPage]);

  React.useEffect(() => {
    onNodesChange?.(computedLayout.nodes);
  }, [computedLayout.nodes, onNodesChange]);

  const nodeById = React.useMemo(() => {
    return new Map(computedLayout.nodes.map((node) => [node.entity.id, node]));
  }, [computedLayout.nodes]);

  const renderedEntities = preserveOffscreen
    ? entities
    : computedLayout.nodes.map((node) => node.entity);

  React.useLayoutEffect(() => {
    if (!enableFlip || typeof window === 'undefined') {
      const nextSnapshots = new Map<string, { rect: DOMRect; visible: boolean }>();
      renderedEntities.forEach((entity) => {
        const element = entityElementRefs.current.get(entity.id);
        if (!element) return;
        nextSnapshots.set(entity.id, {
          rect: element.getBoundingClientRect(),
          visible: nodeById.has(entity.id),
        });
      });
      previousRectSnapshots.current = nextSnapshots;
      return;
    }

    const nextSnapshots = new Map<string, { rect: DOMRect; visible: boolean }>();

    renderedEntities.forEach((entity) => {
      const element = entityElementRefs.current.get(entity.id);
      if (!element) return;

      const currentRect = element.getBoundingClientRect();
      const isVisible = nodeById.has(entity.id);
      const previousSnapshot = previousRectSnapshots.current.get(entity.id);
      const activeAnimation = activeAnimations.current.get(entity.id);

      activeAnimation?.cancel();
      activeAnimations.current.delete(entity.id);

      const previousVisible = previousSnapshot?.visible ?? false;
      const hasGeometryChange = !!previousSnapshot && (previousVisible || isVisible);

      if (hasGeometryChange && previousSnapshot) {
        const deltaX = previousSnapshot.rect.left - currentRect.left;
        const deltaY = previousSnapshot.rect.top - currentRect.top;
        const scaleX = currentRect.width ? previousSnapshot.rect.width / currentRect.width : 1;
        const scaleY = currentRect.height ? previousSnapshot.rect.height / currentRect.height : 1;
        const fromOpacity = previousVisible ? 1 : 0;
        const toOpacity = isVisible ? 1 : 0;

        if (
          Math.abs(deltaX) > 0.5 ||
          Math.abs(deltaY) > 0.5 ||
          Math.abs(scaleX - 1) > 0.01 ||
          Math.abs(scaleY - 1) > 0.01 ||
          fromOpacity !== toOpacity
        ) {
          const animation = element.animate(
            [
              {
                transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
                opacity: fromOpacity,
              },
              {
                transform: 'translate(0px, 0px) scale(1, 1)',
                opacity: toOpacity,
              },
            ],
            {
              duration: transitionDuration,
              easing: transitionEasing,
              fill: 'both',
              composite: 'add',
            },
          );

          animation.onfinish = () => {
            if (activeAnimations.current.get(entity.id) === animation) {
              activeAnimations.current.delete(entity.id);
            }
          };
          animation.oncancel = () => {
            if (activeAnimations.current.get(entity.id) === animation) {
              activeAnimations.current.delete(entity.id);
            }
          };

          activeAnimations.current.set(entity.id, animation);
        }
      } else if (isVisible) {
        const animation = element.animate(
          [
            {
              transform: `scale(${hiddenScale})`,
              opacity: 0,
            },
            {
              transform: 'scale(1)',
              opacity: 1,
            },
          ],
          {
            duration: transitionDuration,
            easing: transitionEasing,
            fill: 'both',
            composite: 'add',
          },
        );

        animation.onfinish = () => {
          if (activeAnimations.current.get(entity.id) === animation) {
            activeAnimations.current.delete(entity.id);
          }
        };
        animation.oncancel = () => {
          if (activeAnimations.current.get(entity.id) === animation) {
            activeAnimations.current.delete(entity.id);
          }
        };

        activeAnimations.current.set(entity.id, animation);
      }

      nextSnapshots.set(entity.id, {
        rect: currentRect,
        visible: isVisible,
      });
    });

    previousRectSnapshots.current = nextSnapshots;

    return () => {
      activeAnimations.current.forEach((animation) => animation.cancel());
      activeAnimations.current.clear();
    };
  }, [enableFlip, hiddenScale, nodeById, renderedEntities, transitionDuration, transitionEasing]);

  const layoutState = React.useMemo<UnifiedLayoutState<TEntity>>(
    () => ({
      nodes: computedLayout.nodes,
      currentPage: computedLayout.currentPage,
      totalPages: computedLayout.totalPages,
      layoutType: computedLayout.layoutType,
      width,
      height,
      focusEntity: computedLayout.focusEntity,
      setPage,
      nextPage,
      prevPage,
    }),
    [computedLayout, height, nextPage, prevPage, setPage, width],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        ...style,
      }}
      {...props}
    >
      {entities.length === 0 && resolveEmptyRenderer(renderEmpty)}
      {renderedEntities.map((entity) => {
        const node = nodeById.get(entity.id) ?? null;
        const renderState: UnifiedLayoutRenderState<TEntity> = {
          entity,
          node,
          isVisible: !!node,
          isFocus: !!node?.isFocus,
          area: node?.area ?? 'hidden',
        };

        return (
          <div
            key={entity.id}
            ref={(element) => {
              if (element) {
                entityElementRefs.current.set(entity.id, element);
              } else {
                entityElementRefs.current.delete(entity.id);
              }
            }}
            data-layout-entity-id={entity.id}
            data-layout-area={renderState.area}
            data-layout-visible={renderState.isVisible}
            style={buildEntityStyle(node, {
              width,
              height,
              hiddenScale,
              enableFlip,
              transitionDuration,
              transitionEasing,
            })}
          >
            <div style={{ width: '100%', height: '100%' }}>
              {renderEntity(entity, renderState)}
            </div>
          </div>
        );
      })}
      {renderOverlay?.(layoutState)}
    </div>
  );
}