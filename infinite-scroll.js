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
        this.renderedElements = {};
        this.prevStart = 0;
        this.prevEnd = 0;
        this.boundScrollListener = this.scrollListener.bind(this);
        this.container.style.height = this.manager.getOffsetByIndex(this.data.length) + 'px';
        if (!options.noStart) this.start();
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
    start: {
      value: function () {
        if (!this.stopped) return;
        this.scrollListener();
        window.addEventListener('scroll', this.boundScrollListener);
      }
    },
    stop: {
      value: function () {
        if (this.stopped) return;
        window.removeEventListener('scroll', this.boundScrollListener);
      }
    },
    scrollListener: {
      value: function () {
        var containerRect = this.container.getBoundingClientRect();
        var start = this.manager.getMinIndexByOffset(-containerRect.top - this.spare);
        var end = this.manager.getMaxIndexByOffset(window.innerHeight - containerRect.top + this.spare);
        start = isNaN(start) ? 0 : Math.max(0, start);
        end = isNaN(end) ? this.data.length - 1 : Math.min(this.data.length - 1, end);
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
        this.prevStart = start;
        this.prevEnd = end;
        for (var i = start; i <= end; i++) {
          if (!this.renderedElements[i]) {
            this.renderedElements[i] = this.acquireElement();
            this.renderer.updateOffset(this.renderedElements[i], this.manager.getOffsetByIndex(i));
            this.renderer.render(this.renderedElements[i], this.data[i], i);
            this.container.insertBefore(this.renderedElements[i], null);
          }
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
            }
          },
          clean: {
            value: function (element) {
              while (element.firstChild) {
                element.removeChild(element.firstChild);
              }
            }
          },
          updateOffset: {
            value: function (element, offset) {
              element.style.top = offset + 'px';
            }
          },
          render: {
            value: function (element, item, index) {
              element.insertBefore(item, null);
            }
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
          getOffsetByIndex: function (index) {
            return index * height;
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
