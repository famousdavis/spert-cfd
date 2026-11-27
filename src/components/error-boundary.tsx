// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * v0.16.4: shown instead of the full-screen message, for a boundary
   * around one part of the app. Give the boundary a `key` that changes when
   * the user moves on (the tab, say), so the part is tried again then.
   */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.props.fallback !== undefined) {
      return this.props.fallback;
    }
    if (this.state.hasError) {
      // The outermost crash screen (contract §7, v0.23.0, FRAME26 clean-up
      // C11): the boundary around the frame itself, so it stays outside the
      // frame on purpose, on the page ground (#ffffff / #101828) in the
      // frame's heading and muted text colours, with a way to reload. One
      // wording in every SPERT® app that has one (William, 2026-11-26). Until
      // v0.23.0 it sat on <body>'s gray-50 with a red title and said "Your
      // data is safe in local storage.", which a cloud user's data is not.
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center dark:bg-[#101828]">
          <h1 className="mb-2 text-xl font-bold text-[#333333] dark:text-[#e2e8f0]">
            Something went wrong
          </h1>
          <p className="mb-4 text-[#6a7282] dark:text-[#99a1af]">
            SPERT<span className="sf-mark">®</span> CFD could not display this page. Reload to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
