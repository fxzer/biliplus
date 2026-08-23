class _UTILS {
  static observe(node, callback, options) {
    const observer = new MutationObserver((mutations, ob) => {
      callback(mutations, ob);
    });
    observer.observe(
      node,
      Object.assign(
        {
          childList: true,
          subtree: true
        },
        options
      )
    );
    const disconnect = () => observer.disconnect();
    return disconnect;
  }
}
