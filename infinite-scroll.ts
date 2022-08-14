export interface InfiniteScrollRenderer<T, C> {
  create(): HTMLElement;
  clean(element: HTMLElement): void
  updateOffset(element: HTMLElement, offset: number, height: number, index: number): void;
  render(element: HTMLElement, data: T, index: number, context: C[]): void;
}

export interface InfiniteScrollManager {
  getHeightByIndex(index: number): number;
  getMinOffsetByIndex(index: number): number;
  getMaxOffsetByIndex(index: number): number;
  getMinIndexByOffset(offset: number): number;
  getMaxIndexByOffset(offset: number): number;
};

export interface InfiniteScrollOptions<T, C> {
  container: HTMLElement;
  renderer: InfiniteScrollRenderer<T, C>;
  manager: InfiniteScrollManager;
  spare?: number;
  initialData?: T[];
  initialCursor;
  dataLoader;
  initialContext: C[];
  noStart?: boolean;
}

export class InfiniteScroll<T, C> {
  stopped: boolean;
  container: HTMLElement;
  renderer: InfiniteScrollRenderer<T, C>;
  manager: InfiniteScrollManager;
  spare: number;
  data: T[];
  elementPool: HTMLElement[];
  renderedElements: HTMLElement[];
  prevStart: number;
  prevEnd: number;
  scrollListener;
  loading: boolean;
  cursor;
  dataLoader;
  context: C[];
  end: boolean;

  static instanceKey = Symbol('InfiniteScroll');

  constructor(options: InfiniteScrollOptions<T, C>) {
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

  setContext(context: C[], initialData: T[], initialCursor): void {
    if (this.context.length == context.length && this.context.every((_, i, a) => a[i] === context[i])) {
      return false;
    }
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
    var self = this;
    var context = self.context;
    this.dataLoader(function addData(data) {
      if (self.context != context) {
        // aborted
        return;
      }
      self.loading = false;
      if (!data) {
        return;
      }
      if (data.end) {
        self.end = true;
      }
      self.cursor = data.cursor;
      Array.prototype.push.apply(self.data, data.data);
      self.updateContainerHeight();
      self.render();
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

  setRenderer(renderer: InfiniteScrollRenderer<T, C>): void {
    this.renderer = renderer;
    this.render(true);
  }

  setManagerAndRenderer(manager: InfiniteScrollManager, renderer: InfiniteScrollRenderer<T, C>): void {
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

  set running(value: boolean): void {
    if (value) {
      this.start();
    } else {
      this.stop();
    }
  }

  static init<T, C>(options: InfiniteScrollOptions<T, C>) {
    Object.defineProperty(options.container, InfiniteScroll.instanceKey, {
      value: new InfiniteScroll(options)
    });
  }

  static getInstance<T, C>(node: HTMLElement): InfiniteScroll<T, C> | undefined {
    for (let current: HTMLElement | null = node; current; current = current.parentElement) {
      if (current[InfiniteScroll.instanceKey as unknown as keyof HTMLElement]) {
        return current[InfiniteScroll.instanceKey as unknown as keyof HTMLElement] as unknown as InfiniteScroll<T, C>;
      }
    }
  }

  static defaultRenderer: InfiniteScrollRenderer<HTMLElement, any> = {
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
