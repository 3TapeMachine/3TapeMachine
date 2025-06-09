/**
 * Lightweight property assignment watching by overriding getters/setters.
 * Intended as a bridge between plain JS properties and other libraries.
 *
 * Inspired by https://gist.github.com/eligrey/384583, which works for
 * data properti1es only, this works for both data and accessor properties.
 *
 * 2015-11-21
 * @author Andy Li
 * 
 * Updated 2025-06-07 by Billy Harris
 */

/**
 * Watches a property for assignment by overriding it with a getter & setter
 * on top of the previous value or accessors.
 *
 * The handler can intercept assignments by returning a different value.
 * Watching an unwritable/unsettable property does nothing, but trying to watch
 * a non-existent or non-configurable property fails fast with TypeError.
 * @param  {!Object} thisArg The object that contains the property.
 * @param  {String}  prop    The name of the property to watch.
 * @param            handler The function to call when the property is
 *   assigned to. Important: this function intercepts assignment;
 *   its return value is set as the new value.
 * @throws {TypeError} if object is null or does not have the property
 * @throws {TypeError} if thisArg.prop is non-configurable
 * @return {?Object}         The previous property descriptor, or null if the
 *   property is not writable/settable.
 */
export function watch(thisArg, prop, handler) {
  const desc = Object.getOwnPropertyDescriptor(thisArg, prop);
  // check pre-conditions: existent, configurable, writable/settable
  if (desc === undefined) {
    throw new TypeError(`Cannot watch nonexistent property '${prop}'`);
  } else if (!desc.configurable) {
    throw new TypeError(`Cannot watch non-configurable property '${prop}'`);
  } else if (!desc.writable && desc.set === undefined) {
    return null; // no-op since property can't change without reconfiguration
  }

  const accessors = (() => {
    if (desc.set) {
      // case: .get/.set
      return {
        get: desc.get,
        set(newval) {
          return desc.set.call(thisArg, handler.call(thisArg, prop, thisArg[prop], newval));
        }
      };
    } else {
      // case: .value
      let val = desc.value;
      return {
        get() {
          return val;
        },
        set(newval) {
          val = handler.call(thisArg, prop, val, newval);
          return val;
        }
      };
    }
  })();
  Object.defineProperty(thisArg, prop, accessors);

  return desc;
}

/**
 * {@link watch} that, if successful, also calls the handler once with
 *   the current value (by setting it).
 * @see watch
 */
export function watchInit(thisArg, prop, handler) {
  const value = thisArg[prop];
  const desc = watch(thisArg, prop, handler);
  if (desc) { thisArg[prop] = value; }
  return desc;
}
