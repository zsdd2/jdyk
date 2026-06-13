package com.wangrizhongxian.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class AppUpdateManagerTest {
  @Test
  fun android9DownloadIsNotBlockedByUnknownSourceInstallPermission() {
    assertFalse(AppUpdateManager.shouldBlockDownloadForInstallPermission(28))
  }

  @Test
  fun android9InstallUsesPackageInstallerAction() {
    assertEquals(
      "android.intent.action.INSTALL_PACKAGE",
      AppUpdateManager.installIntentActionForSdk(28),
    )
  }
}
