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
  fun android9InstallUsesViewActionForVendorInstallerCompatibility() {
    assertEquals(
      "android.intent.action.VIEW",
      AppUpdateManager.installIntentActionForSdk(28),
    )
  }

  @Test
  fun pendingInstallResumesOnlyAfterUnknownSourcePermissionIsGranted() {
    assertFalse(AppUpdateManager.shouldLaunchPendingInstall(false, true))
    assertFalse(AppUpdateManager.shouldLaunchPendingInstall(true, false))
    assertEquals(true, AppUpdateManager.shouldLaunchPendingInstall(true, true))
  }
}
