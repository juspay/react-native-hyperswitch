package com.facebook.react.viewmanagers;

import android.view.View;

public interface HyperGooglePayButtonManagerInterface<T extends View> {
  void setType(T view, int value);
  void setAppearance(T view, int value);
  void setBorderRadius(T view, int value);
}
