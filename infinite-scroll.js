var InfiniteScroll = window.InfiniteScroll = (function () {
  var instanceKey = window.Symbol ? Symbol('InfiniteScroll') : '__IE_POLYFILL__SYMBOL__INFINITE_SCROLL';
  function result(options) {
    if (!(this instanceof result)) {
      throw new Error('InfiniteScroll must called with new operator and options object');
    }
    this.init(options);
  }
  Object.defineProperties(result.prototype, {
    init: {
      value: function (options) {
        this.stopped = true;
        this.container = options.container;
        this.renderer = options.renderer || result.defaultRenderer;
        this.manager = options.manager;
        this.spare = options.spare || 0;
        this.data = options.initialData || [];
        this.elementPool = [];
        this.renderedElements = Object.create(null);
        this.prevStart = 0;
        this.prevEnd = 0;
        this.boundScrollListener = this.scrollListener.bind(this);
        this.loading = false;
        this.cursor = options.initialCursor;
        this.dataLoader = options.dataLoader;
        this.context = options.initialContext || [];
        this.end = false;
        this.updateContainerHeight();
        if (!options.noStart) this.start();
      }
    },
    setContext: {
      value: function (context, initialData, initialCursor) {
        if (this.context.length == context.length && this.context.every(function (_, i, a) {
          return a[i] === context[i];
        })) {
          return false;
        }
        var prevData = this.data;
        this.context = context;
        this.data = initialData || [];
        this.cursor = initialCursor;
        this.loading = false;
        this.end = false;
        this.updateContainerHeight();
        this.scrollListener();
        return prevData;
      }
    },
    updateContainerHeight: {
      value: function () {
        this.container.style.height = (this.data.length && this.manager.getMaxOffsetByIndex(this.data.length - 1) || 0) + 'px';
      }
    },
    loadData: {
      value: function (wantCount) {
        if (this.loading) return false;
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
          self.scrollListener();
        }, this.cursor, context, wantCount);
      }
    },
    acquireElement: {
      value: function () {
        return this.elementPool.length ? this.elementPool.pop() : this.renderer.create();
      }
    },
    releaseElement: {
      value: function (element) {
        if (this.renderer.clean) {
          this.renderer.clean(element);
        }
        this.elementPool.push(element);
      }
    },
    setManager: {
      value: function (manager) {
        this.manager = manager;
        this.scrollListener(true);
      }
    },
    setRenderer: {
      value: function (renderer) {
        this.renderer = renderer;
        this.scrollListener(true);
      }
    },
    setManagerAndRenderer: {
      value: function (manager, renderer) {
        this.manager = manager;
        this.renderer = renderer;
        this.scrollListener(true);
      }
    },
    start: {
      value: function () {
        if (!this.stopped) return;
        this.stopped = false;
        this.scrollListener();
        window.addEventListener('scroll', this.boundScrollListener);
      }
    },
    stop: {
      value: function () {
        if (this.stopped) return;
        this.stopped = true;
        window.removeEventListener('scroll', this.boundScrollListener);
      }
    },
    scrollListener: {
      value: function (rerender) {
        var containerRect = this.container.getBoundingClientRect();
        var start = this.manager.getMinIndexByOffset(-containerRect.top - this.spare);
        var screenEnd = this.manager.getMaxIndexByOffset(window.innerHeight - containerRect.top + this.spare);
        start = isNaN(start) ? 0 : Math.max(0, start);
        screenEnd = isNaN(screenEnd) ? undefined : screenEnd;
        var end = screenEnd === undefined ? this.data.length - 1 : Math.min(this.data.length - 1, screenEnd);
        for (var i = this.prevStart; i < start && this.renderedElements[i]; i++) {
          this.renderedElements[i].parentElement.removeChild(this.renderedElements[i]);
          this.releaseElement(this.renderedElements[i]);
          delete this.renderedElements[i];
        }
        for (var i = this.prevEnd; i > end && this.renderedElements[i]; i--) {
          this.renderedElements[i].parentElement.removeChild(this.renderedElements[i]);
          this.releaseElement(this.renderedElements[i]);
          delete this.renderedElements[i];
        }
        if (rerender) {
          for (var i in this.renderedElements) {
            this.renderer.updateOffset(this.renderedElements[i], this.manager.getMinOffsetByIndex(i), this.manager.getHeightByIndex(i), i);
            this.renderer.clean(this.renderedElements[i]);
            this.renderer.render(this.renderedElements[i], this.data[i], i, this.context);
          }
          this.updateContainerHeight();
        }
        this.prevStart = start;
        this.prevEnd = end;
        for (var i = start; i <= end; i++) {
          if (!this.renderedElements[i]) {
            this.renderedElements[i] = this.acquireElement();
            this.renderer.updateOffset(this.renderedElements[i], this.manager.getMinOffsetByIndex(i), this.manager.getHeightByIndex(i), i);
            this.renderer.render(this.renderedElements[i], this.data[i], i, this.context);
            this.container.insertBefore(this.renderedElements[i], null);
          }
        }
        if (screenEnd >= this.data.length - 1 && !this.end) {
          this.loadData(screenEnd - this.data.length + 1);
        }
      }
    },
    running: {
      enumerable: true,
      get: function () {
        return !this.stopped;
      },
      set: function (value) {
        if (value) {
          this.start();
        } else {
          this.stop();
        }
      }
    }
  });
  Object.defineProperties(result, {
    instanceKey: {
      value: instanceKey
    },
    init: {
      value: function (options) {
        if (!options.container) {
          throw new Error('container options is required');
        }
        Object.defineProperty(options.container, instanceKey, {
          value: new result(options)
        });
      }
    },
    getInstance: {
      value: function (node) {
        for (var current = node; current; current = current.parentElement) {
          if (current[instanceKey]) {
            return current[instanceKey];
          }
        }
      }
    },
    defaultRenderer: {
      value: (function () {
        var renderer = Object.create(null);
        Object.defineProperties(renderer, {
          create: {
            value: function () {
              var element = document.createElement('div');
              element.style.position = 'absolute';
              return element;
            },
            enumerable: true
          },
          clean: {
            value: function (element) {
              while (element.firstChild) {
                element.removeChild(element.firstChild);
              }
            },
            enumerable: true
          },
          updateOffset: {
            value: function (element, offset, height, _index) {
              element.style.top = offset + 'px';
              element.style.height = height + 'px';
            },
            enumerable: true
          },
          render: {
            value: function (element, item, _index) {
              element.insertBefore(item, null);
            },
            enumerable: true
          }
        });
        return renderer;
      })()
    },
    basicManager: {
      value: function (height, spareCount) {
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
  });
  return result;
})();
