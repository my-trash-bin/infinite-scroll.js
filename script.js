window.addEventListener('DOMContentLoaded', function () {
  var END = 333;
  InfiniteScroll.init({
    container: document.getElementById('infinite-scroll-test-container'),
    dataLoader: function (addData, cursor, context, count) {
      count = count || 10;
      setTimeout(function () {
        count = Math.min(END - cursor, count);
        addData({
          data: Array.from(new Array(count)).map(function (_, i) {
            var element = document.createElement('div');
            element.innerText = '[' + context.join(', ') + '] - ' + (cursor + i + 1);
            return element;
          }),
          cursor: cursor + count,
          end: cursor + count == END
        });
      }, 500);
    },
    initialCursor: 0,
    initialContext: [],
    manager: InfiniteScroll.basicManager(24)
  });
});
