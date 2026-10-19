/** The shapes the navigation components take: breadcrumbs, the contents list and the pager. */

/** A page above the current one, in a breadcrumb trail. */
export interface Crumb {
  readonly label: string;
  readonly href: string;
}

/** A numbered section in a page's contents list: its anchor and its name. */
export interface ContentsItem {
  readonly id: string;
  readonly label: string;
}

/** A page the pager leads to. */
export interface PagerLink {
  readonly label: string;
  readonly href: string;
}
