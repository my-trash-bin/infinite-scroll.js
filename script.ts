import { InfiniteScroll, InfiniteScrollManager, InfiniteScrollRenderer } from "./infinite-scroll";

interface Data {
  index: number;
  text: string;
}

type Context = [string, number];

window.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('infinite-scroll-test-container')!;
  const selectManager = document.getElementById('infinite-scroll-test-manager')! as HTMLSelectElement;
  const selectContext = document.getElementById('infinite-scroll-test-context')! as HTMLSelectElement;
  const inputMax = document.getElementById('infinite-scroll-test-max')! as HTMLInputElement;

  const managers: Record<'row' | 'col-3', InfiniteScrollManager> = {
    row: InfiniteScroll.basicManager(48, 10),
    'col-3': {
      getHeightByIndex: () => {
        return 72;
      },
      getMinOffsetByIndex: (index: number) => {
        return Math.floor(index / 3) * 72;
      },
      getMaxOffsetByIndex: (index: number) => {
        return (Math.floor(index / 3) + 1) * 72;
      },
      getMinIndexByOffset: (offset: number) => {
        return Math.floor(offset / 72 - 10) * 3;
      },
      getMaxIndexByOffset: (offset: number) => {
        return Math.ceil(offset / 72 + 10) * 3 + 3;
      }
    }
  };
  function render(element: HTMLElement, item: Data) {
    element.innerHTML = '' +
    '<div style="box-sizing: border-box; width: 100%; height: 100%; border: 3px solid #BBFF88; border-radius: 24px;">' +
      '<div>' +
        '<span>' + (item.index + 1) + '</span>' +
        item.text +
      '</div>' +
    '</div>' +
    '';
  }
  const renderers: Record<'row' | 'col-3', InfiniteScrollRenderer<Data, Context>> = {
    row: {
      ...InfiniteScroll.defaultRenderer,
      updateOffset: function (element, offset, height) {
        element.style.top = offset + 'px';
        element.style.height = height + 'px';
        element.style.left = '';
        element.style.width = '100%';
      },
      render,
    },
    'col-3': {
      ...InfiniteScroll.defaultRenderer,
      updateOffset: function (element, offset, height, index) {
        element.style.top = offset + 'px';
        element.style.height = height + 'px';
        element.style.left = (index % 3) * 33 + '%';
        element.style.width = '33%';
      },
      render,
    },
  };

  function getData(index: number, context: Context): Data {
    return {
      index: index,
      text: context[0]
    };
  }

  function dataLoader(addData: (result: { data: Data[], cursor: number, end: boolean }) => void, cursor: number, context: Context, count: number) {
    count = count || 10;
    const END = context[1];
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

  function getContext(): [string, number] | undefined {
    const max = parseInt(inputMax.value, 10);
    if (!max) return undefined;
    return [selectContext.value, max];
  }
  function updateContext() {
    const newContext = getContext();
    if (newContext) {
      InfiniteScroll.getInstance(container)!.setContext(newContext, [], 0);
    }
  }

  InfiniteScroll.init({
    container: container,
    dataLoader: dataLoader,
    renderer: renderers[selectManager.value as 'row' | 'col-3'],
    initialCursor: 0,
    initialContext: getContext()!,
    manager: managers.row
  });

  selectContext.addEventListener('change', updateContext);
  inputMax.addEventListener('change', updateContext);

  selectManager.addEventListener('change', function () {
    InfiniteScroll.getInstance(container)!.setManagerAndRenderer(
      managers[selectManager.value as 'row' | 'col-3'],
      renderers[selectManager.value as 'row' | 'col-3']
    );
  });
});
