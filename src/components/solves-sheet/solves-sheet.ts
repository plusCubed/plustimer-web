import {Observable, Subject} from "rxjs/Rx";
import {Component, HostBinding, HostListener, Injectable, ViewChild} from "@angular/core";
import {Solve, SolvesService} from "../../providers/solves.service";
import {Content, Platform, VirtualScroll} from "ionic-angular";
import {Util} from "../../app/util";
import {style} from "@angular/animations";
import {DomSanitizer} from "@angular/platform-browser";

export const expandedY = '16px';
export const collapsedY = '100% - 48px - 24px';

@Injectable()
export class Presenter {
  solvesService: SolvesService;

  constructor(solvesService: SolvesService) {
    this.solvesService = solvesService;
  }

  viewModel$(intent: Intent) {
    return Observable.merge(this.solvesService.getAll()
      .map(solves => solves.reverse())
      .map(solves => new ViewModel(solves)))
      .startWith(new ViewModel([]));
  }
}

@Component({
  selector: 'solves-sheet',
  templateUrl: 'solves-sheet.html'
})
export class SolvesSheetComponent implements View {
  private viewModel: ViewModel;

  private offset = 0;

  private itemWidth;

  private expanded = false;

  private isAnimating = false;
  private state: ScrollState;

  private lastY = -1;
  private lastDy = 0;
  private isSecondTouch = false;

  @ViewChild(Content)
  private scrollContent: Content;
  @ViewChild(VirtualScroll)
  private virtualScroll;

  private scrollContentElement: HTMLElement;
  private scrollFiring: Subject<any>;

  constructor(private solvesService: SolvesService,
              private platform: Platform,
              private sanitizer: DomSanitizer,
              private presenter: Presenter) {

    this.presenter.viewModel$(this.intent())
      .do(null, err => console.log('%s', err))
      .onErrorResumeNext(Observable.empty<ViewModel>())
      .subscribe(viewModel => this.viewModel = viewModel);
  }

  @HostBinding('style.transition')
  get transition() {
    if (this.isAnimating) {
      return this.safe(`transform 225ms cubic-bezier(0.0, 0.0, 0.2, 1)`);
    } else {
      return this.safe('');
    }
  }

  @HostBinding('style.transform')
  get transform() {
    if (!this.expanded) {
      return this.safe(`translate3d(0, calc(${collapsedY} - ${-this.offset}px), 0)`);
    } else {
      return this.safe(`translate3d(0, calc(${expandedY} - ${-this.offset}px), 0)`);
    }
  }

  get isFullBarHeight() {
    return this.expanded || this.state == ScrollState.PANNING || this.isAnimating;
  }

  ngAfterViewInit() {
    this.scrollContentElement = this.scrollContent._scrollContent.nativeElement;
    this.calcItemWidth();
  }

  onArrowClick() {
    if (this.isAnimating) {
      return;
    }

    this.state = ScrollState.IDLE;
    this.setScrollEnabled(false);

    this.scrollContent.scrollToTop();

    this.animateExpanded(!this.expanded);
  }

  findAncestor(el: HTMLElement, cls: string) {
    const elements = el.parentElement.parentElement.parentElement.getElementsByClassName(cls);
    return elements.item(0);
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(e: any) {
    if (this.isAnimating) {
      return;
    }

    let touchobj = e.changedTouches[0];
    const dY = touchobj.clientY - this.lastY;

    if (this.lastY == -1) {
      //Initial touch event: set baseline Y
      this.isSecondTouch = true;

    } else if (this.isSecondTouch) {
      //Second touch event: determine direction, whether to move the sheet

      if (this.state != ScrollState.REAL_SCROLLING && !this.expanded ||
        !this.scrollFiring && this.scrollContent.scrollTop == 0 && dY > 0) {
        this.setScrollEnabled(false);
        this.state = ScrollState.PANNING;
        this.offset = 0;
      }

      this.isSecondTouch = false;

    } else {
      //Later touch events: move the sheet

      if (this.state == ScrollState.PANNING) {
        this.setScrollEnabled(false);
        this.offset = this.offset + dY;
      }

      this.lastDy = dY;
    }


    this.lastY = touchobj.clientY;
  }

  @HostListener('touchend')
  onTouchEnd() {
    if (this.isAnimating || this.platform.is('core')) {
      return;
    }

    if (this.state == ScrollState.PANNING && this.offset != 0) {
      //If moving the sheet, set expanded status
      this.animateExpanded(this.lastDy < 0);
    }

    this.state = ScrollState.IDLE;

    this.lastY = -1;
    this.lastDy = -1;
  }

  @HostListener('transitionend')
  onTransitionEnd() {
    this.isAnimating = false;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.calcItemWidth();

    //Reset Virtual Scroll
    this.virtualScroll.readUpdate(true);
    this.virtualScroll.writeUpdate(true);
  }

  safe(html) {
    return this.sanitizer.bypassSecurityTrustStyle(html);
  }

  trackById(index: number, item: any): number {
    return item._id;
  }

  intent(): Intent {
    return {};
  }

  displayTime(solve: Solve) {
    return Util.formatTime(solve.time);
  }

  private setScrollEnabled(enabled: boolean) {
    if (!!this.scrollContentElement) {
      this.scrollContentElement.style.overflowY = enabled ? "auto" : "hidden";
    }
  }

  private animateExpanded(expanded: boolean) {
    this.expanded = expanded;

    this.offset = 0;
    this.isAnimating = true;
    this.setScrollEnabled(expanded);
  }

  private calcItemWidth() {
    const width = this.scrollContentElement.clientWidth;
    //Max whole number of columns that will fit
    const columns = Math.trunc(width / 64);
    //Truncate to whole number pixels (otherwise virtualscroll puts last item on next line)
    const pixels = Math.trunc(width / columns);

    this.itemWidth = `${pixels}px`;
  }
}

enum ScrollState {
  IDLE, PANNING, REAL_SCROLLING, FAKE_SCROLLING
}

export class ViewModel {

  constructor(public readonly solves: Array<Solve>) {
    console.log("" + solves.length);
  }
}

export interface View {
  intent(): Intent;
}

export interface Intent {
}
