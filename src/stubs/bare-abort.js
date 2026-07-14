// Stub for the native `bare-abort` addon, which has no browser binary.
// The npm `process` polyfill expects `require("bare-abort").addon`, but in the
// browser we never need the native abort/signal binding, so we return a noop.
module.exports = {
  addon: function () {
    return {
      constants: {},
      kill: function () {},
      on: function () {},
      once: function () {},
      removeListener: function () {},
    };
  },
};
