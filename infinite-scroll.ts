export interface InfiniteScrollRenderer<Data, Context extends any[]> {
  create(): HTMLElement;
  clean(element: HTMLElement): void
  updateOffset(element: HTMLElement, offset: number, height: number, index: number): void;
  render(element: HTMLElement, data: Data, index: number, context: Context | undefined): void;
}

export interface InfiniteScrollManager {
  getHeightByIndex(index: number): number;
  getMinOffsetByIndex(index: number): number;
  getMaxOffsetByIndex(index: number): number;
  getMinIndexByOffset(offset: number): number;
  getMaxIndexByOffset(offset: number): number;
}

export interface InfiniteScrollOptions<Data, Context extends any[], Cursor> {
  container: HTMLElement;
  renderer: InfiniteScrollRenderer<Data, Context>;
  manager: InfiniteScrollManager;
  spare?: number;
  initialData?: Data[];
  initialCursor: Cursor;
  dataLoader: (onLoad: (result: { data: Data[], cursor: Cursor, end: boolean }) => void, cursor: Cursor, context: Context, wantCount: number) => void;
  initialContext: Context;
  noStart?: boolean;
}

export class InfiniteScroll<Data, Context extends any[], Cursor> {
  stopped: boolean;
  container: HTMLElement;
  renderer: InfiniteScrollRenderer<Data, Context>;
  manager: InfiniteScrollManager;
  spare: number;
  data: Data[];
  elementPool: HTMLElement[];
  renderedElements: HTMLElement[];
  prevStart: number;
  prevEnd: number;
  scrollListener;
  loading: boolean;
  cursor: Cursor;
  dataLoader: (onLoad: (result: { data: Data[], cursor: Cursor, end: boolean }) => void, cursor: Cursor, context: Context, wantCount: number) => void;
  context: Context;
  end: boolean;

  static instanceKey = Symbol('InfiniteScroll');

  constructor(options: InfiniteScrollOptions<Data, Context, Cursor>) {
    this.stopped = true;
    this.container = options.container;
    this.renderer = options.renderer;
    this.manager = options.manager;
    this.spare = options.spare || 0;
    this.data = options.initialData || [];
    this.elementPool = [];
    this.renderedElements = Object.create(null);
    this.prevStart = 0;
    this.prevEnd = 0;
    this.scrollListener = () => this.render();
    this.loading = false;
    this.cursor = options.initialCursor;
    this.dataLoader = options.dataLoader;
    this.context = options.initialContext || [];
    this.end = false;
    this.updateContainerHeight();
    if (!options.noStart) this.start();
  }

  setContext(context: Context, initialData: Data[], initialCursor: Cursor): Data[] | undefined {
    if (this.context.length == context.length &&
      this.context.every((_, i, a) => a[i] === context[i]))
        return undefined;
    const prevData = this.data;
    this.context = context;
    this.data = initialData || [];
    this.cursor = initialCursor;
    this.loading = false;
    this.end = false;
    this.updateContainerHeight();
    this.render();
    return prevData;
  }

  updateContainerHeight(): void {
    this.container.style.height = (this.data.length && this.manager.getMaxOffsetByIndex(this.data.length - 1) || 0) + 'px';
  }

  loadData(wantCount: number): void {
    if (this.loading) return;
    this.loading = true;
    const context = this.context;
    this.dataLoader((data) => {
      if (this.context != context) {
        // aborted
        return;
      }
      this.loading = false;
      if (!data) {
        return;
      }
      if (data.end) {
        this.end = true;
      }
      this.cursor = data.cursor;
      this.data.push(...data.data);
      this.updateContainerHeight();
      this.render();
    }, this.cursor, context, wantCount);
  }

  acquireElement(): HTMLElement {
    return this.elementPool.length ? this.elementPool.pop()! : this.renderer.create();
  }

  releaseElement(element: HTMLElement): void {
    if (this.renderer.clean) {
      this.renderer.clean(element);
    }
    this.elementPool.push(element);
  }

  setManager(manager: InfiniteScrollManager): void {
    this.manager = manager;
    this.render(true);
  }

  setRenderer(renderer: InfiniteScrollRenderer<Data, Context>): void {
    this.renderer = renderer;
    this.render(true);
  }

  setManagerAndRenderer(manager: InfiniteScrollManager, renderer: InfiniteScrollRenderer<Data, Context>): void {
    this.manager = manager;
    this.renderer = renderer;
    this.render(true);
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.render();
    window.addEventListener('scroll', this.scrollListener);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    window.removeEventListener('scroll', this.scrollListener);
  }

  render(force?: boolean): void {
    const containerRect = this.container.getBoundingClientRect();
    let screenEnd: number | undefined;
    let start = this.manager.getMinIndexByOffset(-containerRect.top - this.spare);
    screenEnd = this.manager.getMaxIndexByOffset(window.innerHeight - containerRect.top + this.spare);
    start = isNaN(start) ? 0 : Math.max(0, start);
    screenEnd = isNaN(screenEnd) ? undefined : screenEnd;
    const end = screenEnd === undefined ? this.data.length - 1 : Math.min(this.data.length - 1, screenEnd);
    for (let i = this.prevStart; i < start && this.renderedElements[i]; i++) {
      this.renderedElements[i].parentElement!.removeChild(this.renderedElements[i]);
      this.releaseElement(this.renderedElements[i]);
      delete this.renderedElements[i];
    }
    for (let i = this.prevEnd; i > end && this.renderedElements[i]; i--) {
      this.renderedElements[i].parentElement!.removeChild(this.renderedElements[i]);
      this.releaseElement(this.renderedElements[i]);
      delete this.renderedElements[i];
    }
    if (force) {
      for (let i = 0; i < this.renderedElements.length; i++) {
        this.renderer.clean(this.renderedElements[i]);
        this.renderer.updateOffset(this.renderedElements[i], this.manager.getMinOffsetByIndex(i), this.manager.getHeightByIndex(i), i);
        this.renderer.render(this.renderedElements[i], this.data[i], i, this.context);
      }
      this.updateContainerHeight();
    }
    this.prevStart = start;
    this.prevEnd = end;
    for (let i = start; i <= end; i++) {
      if (!this.renderedElements[i]) {
        this.renderedElements[i] = this.acquireElement();
        this.renderer.updateOffset(this.renderedElements[i], this.manager.getMinOffsetByIndex(i), this.manager.getHeightByIndex(i), i);
        this.renderer.render(this.renderedElements[i], this.data[i], i, this.context);
        this.container.insertBefore(this.renderedElements[i], null);
      }
    }
    if (end >= this.data.length - 1 && !this.end) {
      this.loadData(end - this.data.length + 1);
    }
  }

  get running(): boolean {
    return !this.stopped;
  }

  set running(value: boolean) {
    if (value) {
      this.start();
    } else {
      this.stop();
    }
  }

  static init<Data, Context extends any[], Cursor>(options: InfiniteScrollOptions<Data, Context, Cursor>) {
    Object.defineProperty(options.container, InfiniteScroll.instanceKey, {
      value: new InfiniteScroll(options)
    });
  }

  static getInstance<Data, Context extends any[], Cursor>(node: HTMLElement): InfiniteScroll<Data, Context, Cursor> | undefined {
    for (let current: HTMLElement | null = node; current; current = current.parentElement) {
      if (current[InfiniteScroll.instanceKey as unknown as keyof HTMLElement]) {
        return current[InfiniteScroll.instanceKey as unknown as keyof HTMLElement] as unknown as InfiniteScroll<Data, Context, Cursor>;
      }
    }
  }

  static defaultRenderer: InfiniteScrollRenderer<Node, any> = {
    create: () => {
      const element = document.createElement('div');
      element.style.position = 'absolute';
      return element;
    },
    clean: (element) => {
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
    },
    updateOffset: (element, offset, height) => {
      element.style.top = offset + 'px';
      element.style.height = height + 'px';
    },
    render: (element, item) => {
      element.insertBefore(item, null);
    },
  };

  static basicManager(height: number, spareCount: number): InfiniteScrollManager {
    spareCount = spareCount || 0;
    return {
      getHeightByIndex: function (_index) {
        return height;
      },
      getMinOffsetByIndex: function (index) {
        return index * height;
      },
      getMaxOffsetByIndex: function (index) {
        return (index + 1) * height;
      },
      getMinIndexByOffset: function (offset) {
        return Math.floor(offset / height - spareCount);
      },
      getMaxIndexByOffset: function (offset) {
        return Math.ceil(offset / height + spareCount);
      }
    };
  }
}
