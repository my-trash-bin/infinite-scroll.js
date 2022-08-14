import { InfiniteScroll } from "./infinite-scroll";

window.addEventListener('DOMContentLoaded', function () {
  var container = document.getElementById('infinite-scroll-test-container');
  var selectManager = document.getElementById('infinite-scroll-test-manager');
  var selectContext = document.getElementById('infinite-scroll-test-context');
  var inputMax = document.getElementById('infinite-scroll-test-max');

  var managers = {
    row: InfiniteScroll.basicManager(48, 10),
    'col-3': {
      getHeightByIndex: function (_index) {
        return 72;
      },
      getMinOffsetByIndex: function (index) {
        return Math.floor(index / 3) * 72;
      },
      getMaxOffsetByIndex: function (index) {
        return (Math.floor(index / 3) + 1) * 72;
      },
      getMinIndexByOffset: function (offset) {
        return Math.floor(offset / 72 - 10) * 3;
      },
      getMaxIndexByOffset: function (offset) {
        return Math.ceil(offset / 72 + 10) * 3 + 3;
      }
    }
  };
  function render(element, item, _index) {
    element.innerHTML = '' +
    '<div style="box-sizing: border-box; width: 100%; height: 100%; border: 3px solid #BBFF88; border-radius: 24px;">' +
      '<div>' +
        '<span>' + (item.index + 1) + '</span>' +
        item.text +
      '</div>' +
    '</div>' +
    '';
  }
  var renderers = {
    row: Object.assign({}, InfiniteScroll.defaultRenderer, {
      updateOffset: function (element, offset, height, _index) {
        element.style.top = offset + 'px';
        element.style.height = height + 'px';
        element.style.left = '';
        element.style.width = '100%';
      },
      render: render
    }),
    'col-3': Object.assign({}, InfiniteScroll.defaultRenderer, {
      updateOffset: function (element, offset, height, index) {
        element.style.top = offset + 'px';
        element.style.height = height + 'px';
        element.style.left = (index % 3) * 33 + '%';
        element.style.width = '33%';
      },
      render: render
    })
  };

  function getData(index, context) {
    return {
      index: index,
      text: context[0]
    };
  }

  function dataLoader(addData, cursor, context, count) {
    count = count || 10;
    var END = context[1];
    setTimeout(function () {
      count = Math.min(END - cursor, count);
      addData({
        data: Array.from(new Array(count)).map(function (_, i) {
          return getData(cursor + i, context);
        }),
        cursor: cursor + count,
        end: cursor + count == END
      });
    }, 500);
  }

  function getContext() {
    var max = parseInt(inputMax.value, 10);
    if (!max) return undefined;
    return [selectContext.value, max];
  }
  function updateContext() {
    var newContext = getContext();
    if (newContext) {
      InfiniteScroll.getInstance(container).setContext(newContext, [], 0);
    }
  }

  InfiniteScroll.init({
    container: container,
    dataLoader: dataLoader,
    renderer: renderers[selectManager.value],
    initialCursor: 0,
    initialContext: getContext(),
    manager: managers.row
  });

  selectContext.addEventListener('change', updateContext);
  inputMax.addEventListener('change', updateContext);

  selectManager.addEventListener('change', function () {
    InfiniteScroll.getInstance(container).setManagerAndRenderer(
      managers[selectManager.value],
      renderers[selectManager.value]
    );
  });
});
