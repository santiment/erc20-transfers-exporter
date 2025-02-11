function transactionOrder(a, b) {
    return a.blockNumber - b.blockNumber || a.transactionPosition - b.transactionPosition;
  }
  
  function stableSort(array, sortFunc) {
    array.forEach((x, i) => x._position = i);
  
    array.sort(function (a, b) {
      let sortResult = sortFunc(a, b);
      if (sortResult !== 0) {
        return sortResult;
      }
      else {
        return a._position - b._position;
      }
    });
  
    array.forEach(x => delete x._position);
  }
  
  
  module.exports = {
    transactionOrder,
    stableSort
  };
  