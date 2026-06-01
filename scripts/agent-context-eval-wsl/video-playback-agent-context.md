---
capability: video-playback
version: 1
last_synced_from: 32762b95

entry_points:
  - path: app/src/main/java/com/wsl/activities/SingleActivity.java
    symbol: getVideoPlayer / mVideoPlayer / onUserLeaveHint / onPictureInPictureModeChanged / isExitingPipMode
    role: "Owns the one player instance per type; drives PiP entry at the Activity layer; exposes the isExitingPipMode flag every guard reads."
  - path: app/src/main/java/com/wsl/android/WslExoPlayer.java
    symbol: setFullScreen
    role: "ExoPlayer backend. Hosts fullscreen in a separate Dialog and owns the orientation-lock + delayed SENSOR-release logic (WSL-8378)."
  - path: app/src/main/java/com/wsl/helpers/PlayerOrientationHelper.java
    symbol: shouldSuppressOrientationSwitch / shouldSuppressPortraitLock
    role: "Single source of truth for the two orientation guards every host fragment must apply."
  - path: app/src/main/java/com/wsl/fragments/WatchVideoFragment.java
    symbol: onConfigurationChanged / onPlayerStateChange / positionVideoPlayer
    role: "Canonical host fragment. The other three skeleton fragments are near-exact copies; ContentFragment diverges."
  - path: app/src/main/java/com/wsl/helpers/AspCastHelper.java
    symbol: isInstanceConnected
    role: "Chromecast handoff; consulted when deciding minimize-vs-hide on player exit."

invariants:
  - id: single-player-owner
    statement: "Exactly one player instance per PlayerType exists, owned by SingleActivity. Host fragments look it up via getVideoPlayer(...) and never instantiate their own."
    enforced_by: app/src/main/java/com/wsl/activities/SingleActivity.java:375-403
  - id: pip-entry-at-activity
    statement: "Picture-in-Picture is entered only by the Activity in onUserLeaveHint, never by a fragment. Fragments only react to onPictureInPictureModeChanged for UI."
    enforced_by: app/src/main/java/com/wsl/activities/SingleActivity.java:2028-2055
  - id: suppress-orientation-during-pip-exit
    statement: "onConfigurationChanged must call shouldSuppressOrientationSwitch before any setFullScreen, so a PiP-exit window resize does not trigger a fullscreen toggle."
    enforced_by: app/src/main/java/com/wsl/helpers/PlayerOrientationHelper.java:40-50
  - id: setfullscreen-noop-guard
    statement: "setFullScreen early-returns when the requested state equals the current state (mIsFullScreen == fullScreen). Rapid repeat calls in the same state are no-ops."
    enforced_by: app/src/main/java/com/wsl/android/WslExoPlayer.java:693
  - id: no-fullscreen-enter-during-pip-exit
    statement: "setFullScreen(true) is blocked while isExitingPipMode() is true, to avoid a portrait-fullscreen flash during the PiP-to-full window transition."
    enforced_by: app/src/main/java/com/wsl/android/WslExoPlayer.java:703-705
  - id: exo-manages-own-orientation-lock
    statement: "For EXOPLAYER-type players the fragment must NOT apply the PORTRAIT lock in onPlayerStateChange; WslExoPlayer owns the lock + delayed SENSOR release. Only EMBED players still need the fragment-side lock."
    enforced_by: app/src/main/java/com/wsl/helpers/PlayerOrientationHelper.java:66-82

contracts:
  - symbol: SingleActivity.getVideoPlayer
    location: app/src/main/java/com/wsl/activities/SingleActivity.java:375
    input: "@Nullable AspVideoPlayer.PlayerType (null is treated as CURRENT)"
    output: "@Nullable AspVideoPlayer"
    side_effects:
      - "Hides the other two player backends."
      - "Toggles the Chromecast menu item visibility (on only for EXOPLAYER)."
      - "May return null if the requested player fragment is not found."
  - symbol: AspVideoPlayer.setFullScreen
    location: app/src/main/java/com/wsl/android/WslExoPlayer.java:692
    input: "boolean fullScreen"
    output: "void"
    side_effects:
      - "Shows or dismisses the fullscreen Dialog."
      - "May call setRequestedOrientation (LANDSCAPE/PORTRAIT) then schedule a delayed SENSOR release."
      - "On exit, fires onPlayerStateChange(STATE_NOT_FULLSCREEN) to the observer -- but NOT during PiP exit."
  - symbol: AspVideoPlayerStateObserver.onPlayerStateChange
    location: app/src/main/java/com/wsl/interfaces/AspVideoPlayerStateObserver.java:7
    input: "AspVideoPlayer.PlayerState"
    output: "void"
    side_effects:
      - "Host fragments use STATE_NOT_FULLSCREEN to re-apply the portrait lock (EMBED only) and call positionVideoPlayer()."

upstream_deps:
  - "Media3 ExoPlayer 1.8.0 (ExoPlayer backend)"
  - "Google IMA SDK (ad playback; AdDisplayContainer lifecycle)"
  - "SingleActivity lifecycle (onUserLeaveHint, onPictureInPictureModeChanged, configuration changes)"

downstream_consumers:
  - "Five host fragments (Content, Event, WatchVideo, LiveBroadcastVideo, LiveBroadcastEvent): re-attach to the player in onResume and reposition it."
  - "Chromecast (AspCastHelper): receives playback handoff; influences minimize-vs-hide decisions on exit."

common_changes:
  - description: "Change rotation / PiP / fullscreen behavior"
    touches:
      - app/src/main/java/com/wsl/helpers/PlayerOrientationHelper.java
      - app/src/main/java/com/wsl/android/WslExoPlayer.java
      - app/src/main/java/com/wsl/fragments/ContentFragment.java
      - app/src/main/java/com/wsl/fragments/EventFragment.java
      - app/src/main/java/com/wsl/fragments/WatchVideoFragment.java
      - app/src/main/java/com/wsl/fragments/LiveBroadcastVideoFragment.java
      - app/src/main/java/com/wsl/ui/livebroadcastevent/LiveBroadcastEventFragment.java
  - description: "Adjust where/how the player sits on screen for one host"
    touches:
      - "positionVideoPlayer() in the relevant host fragment"
  - description: "Add a new screen that embeds the player"
    touches:
      - "New Fragment replicating the onConfigurationChanged skeleton + getVideoPlayer lookup in onResume + getSingleActivity().getVideoPlayer(...) re-attach"

gotchas:
  - "Fullscreen is hosted in a SEPARATE Dialog window, not the Activity window. System bars are hidden on the Dialog. Consequence: the fullscreen player and its controls do NOT appear in uiautomator/`android layout` dumps -- those only traverse the Activity window."
  - "During PiP exit, getDisplayDimensions() returns PiP-era (tiny) values. setFullScreen(false) deliberately SKIPS resetLayoutToDefaultDimensions when isExitingPipMode is true; onResume()'s positionVideoPlayer() finalizes the layout once the window is full-size. (WslExoPlayer.java:776-784)"
  - "On fullscreen exit, the STATE_NOT_FULLSCREEN observer callback is suppressed while isExitingPipMode is true -- firing it would reposition the player using PiP-era dimensions and undo the preservation above. (WslExoPlayer.java:800-802)"
  - "EventFragment and ContentFragment still run a legacy 5-second SCREEN_ORIENTATION_SENSOR-restore runnable. Since WSL-8378 it is a NO-OP duplicate, superseded by WslExoPlayer.scheduleOrientationLockRelease(). onEnterPictureInPicture() cancels any pending runnable so it cannot overwrite the SENSOR_PORTRAIT lock applied on PiP exit. (SingleActivity.java:1961-1965)"
  - "EMBED / YouTube players do NOT route through WslExoPlayer.setFullScreen, so they still need the fragment-side PORTRAIT lock. The shouldSuppressPortraitLock guard returns true for non-EMBED precisely to avoid double-locking EXOPLAYER."
  - "Dismissing the PiP window (X) while an ad is playing leaks audio: onPause's PiP guard skipped the pause on entry and no onResume follows a dismiss. onPictureInPictureModeChanged(false) explicitly pauses, using mStoppedWhileInPip to distinguish a dismiss from an expand. (SingleActivity.java:1973-1988)"
  - "onDestroyView preserves the IMA AdDisplayContainer across a rotation-driven destroy (shouldPreserveAdStateOnDestroyView) because IMA cannot re-attach during the same ad play. Calling hide() unconditionally would break mid-ad rotation. (WatchVideoFragment.java:228-239)"
  - "ContentFragment does NOT follow the shared onConfigurationChanged skeleton -- it hosts article + video in a list view and needs a divergent flow. Do not assume the 5 fragments are interchangeable."
  - "The human docs' code map points player implementations at com/wsl/players/; they actually live in com/wsl/android/ (WslExoPlayer, WslBaseVideoPlayer, WslEmbedVideoPlayer)."

cross_refs:
  # Single-capability bootstrap. Chromecast and the ad/IMA layer are
  # tightly coupled but not yet documented as their own capabilities.
  - capability: chromecast
    relationship: "TODO -- not yet documented. AspCastHelper.isInstanceConnected gates minimize-vs-hide on player exit."
---

# Video Playback — Agent Context

## Mental model

There is one video player, owned by `SingleActivity`, that outlives the
screens showing it. Five host fragments borrow that single instance and
each re-implement rotation/PiP/fullscreen lifecycle around it. Almost
every subtlety here exists to keep one shared player consistent across
window transitions (rotation, PiP enter/exit, fullscreen Dialog) without
trapping the user in the wrong orientation or leaking ad audio.

## Read order (if you have a small token budget)

1. `helpers/PlayerOrientationHelper.java` (83 lines) — the two guards and
   exactly why each exists.
2. `interfaces/AspVideoPlayer.java` (enums: PlayerType, PlayerState) —
   the vocabulary everything else uses.
3. `android/WslExoPlayer.java` `setFullScreen` (~lines 692-804) — the
   Dialog-hosted fullscreen + orientation-lock heart of the system.
4. `fragments/WatchVideoFragment.java` `onConfigurationChanged` +
   `onPlayerStateChange` (~lines 199-343) — the canonical host skeleton.
5. `activities/SingleActivity.java` `getVideoPlayer` (375) +
   `onPictureInPictureModeChanged` / `onUserLeaveHint` (~1927-2055) —
   player ownership and PiP entry/exit.
