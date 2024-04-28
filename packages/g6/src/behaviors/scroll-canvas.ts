import { isFunction, isObject } from '@antv/util';
import { CanvasEvent } from '../constants';
import type { RuntimeContext } from '../runtime/types';
import type { IKeyboardEvent, Point } from '../types';
import { Shortcut, ShortcutKey } from '../utils/shortcut';
import type { BaseBehaviorOptions } from './base-behavior';
import { BaseBehavior } from './base-behavior';

export interface ScrollCanvasOptions extends BaseBehaviorOptions {
  /**
   * <zh/> 是否启用滚动画布的功能
   *
   * <en/> Whether to enable the function of scrolling the canvas
   */
  enable?: boolean | ((event: WheelEvent | IKeyboardEvent) => boolean);
  /**
   * <zh/> 触发滚动的方式，默认使用指针滚动
   *
   * <en/> The way to trigger scrolling, default to scrolling with the pointer pressed
   */
  trigger?: CombinationKey;
  /**
   * <zh/> 允许的滚动方向。选项有："x"、"y"，默认情况下没有限制
   *
   * <en/> The allowed rolling direction. The options are "x" and "y", with no restrictions by default
   */
  direction?: 'x' | 'y';
  /**
   * <zh/> 滚动灵敏度
   *
   * <en/> Scroll sensitivity
   */
  sensitivity?: number;
  /**
   * <zh/> 完成滚动时的回调
   *
   * <en/> Callback when scrolling is completed
   */
  onfinish?: () => void;
}

type CombinationKey = {
  up: ShortcutKey;
  down: ShortcutKey;
  left: ShortcutKey;
  right: ShortcutKey;
};

type EnableOptions = {
  node?: boolean;
  edge?: boolean;
  combo?: boolean;
};

export class ScrollCanvas extends BaseBehavior<ScrollCanvasOptions> {
  static defaultOptions: ScrollCanvasOptions = {
    enable: true,
    sensitivity: 1,
  };

  private shortcut: Shortcut;

  constructor(context: RuntimeContext, options: ScrollCanvasOptions) {
    super(context, Object.assign({}, ScrollCanvas.defaultOptions, options));

    this.shortcut = new Shortcut(context.graph);

    this.bindEvents();
  }

  private bindEvents() {
    const { trigger } = this.options;
    this.shortcut.unbindAll();
    const { graph } = this.context;
    if (isObject(trigger)) {
      graph.off(CanvasEvent.WHEEL, this.onWheel);
      const { up = [], down = [], left = [], right = [] } = trigger;

      this.shortcut.bind(up, (event) => this.scroll([0, -10], event));
      this.shortcut.bind(down, (event) => this.scroll([0, 10], event));
      this.shortcut.bind(left, (event) => this.scroll([-10, 0], event));
      this.shortcut.bind(right, (event) => this.scroll([10, 0], event));
    } else {
      /**
       * 这里必需在原生canvas上绑定wheel事件，参考：
       * https://g.antv.antgroup.com/api/event/faq#%E5%9C%A8-chrome-%E4%B8%AD%E7%A6%81%E6%AD%A2%E9%A1%B5%E9%9D%A2%E9%BB%98%E8%AE%A4%E6%BB%9A%E5%8A%A8%E8%A1%8C%E4%B8%BA
       */
      this.graphDom?.addEventListener(CanvasEvent.WHEEL, this.onWheel, { passive: false });
    }
  }

  get graphDom() {
    return this.context.graph.getCanvas().getContextService().getDomElement();
  }

  private onWheel = async (event: WheelEvent) => {
    event.preventDefault();
    const diffX = event.deltaX;
    const diffY = event.deltaY;

    await this.scroll([-diffX, -diffY], event);
  };

  private formatDisplacement([dx, dy]: Point) {
    const { direction, sensitivity } = this.options;

    dx = dx * sensitivity;
    dy = dy * sensitivity;

    if (direction === 'x') {
      dy = 0;
    } else if (direction === 'y') {
      dx = 0;
    }

    return [dx, dy] as Point;
  }

  private async scroll(value: Point, event: WheelEvent | IKeyboardEvent) {
    if (!this.validate(event)) return;
    const { onfinish } = this.options;
    const graph = this.context.graph;
    const formattedValue = this.formatDisplacement(value);
    await graph.translateBy(formattedValue, false);
    onfinish?.();
  }

  private validate(event: WheelEvent | IKeyboardEvent) {
    if (this.destroyed) return false;

    const { enable } = this.options;
    if (isFunction(enable)) return enable(event);
    return !!enable;
  }

  public destroy(): void {
    this.shortcut.destroy();
    this.graphDom?.removeEventListener(CanvasEvent.WHEEL, this.onWheel);
    super.destroy();
  }
}