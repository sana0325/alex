import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, AdOptions, InterstitialAdPluginEvents } from '@capacitor-community/admob';

// TODO: замінити на реальні ID з https://admob.google.com після реєстрації
// Зараз використовуються тестові ID від Google (реальних грошей не приносять)
export const AD_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
};

export async function initAdMob() {
  try {
    await AdMob.initialize({ testingDevices: [], initializeForTesting: true });
  } catch {
    // Web environment — ads not available
  }
}

export async function showBanner() {
  const options: BannerAdOptions = {
    adId: AD_IDS.banner,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: true, // TODO: змінити на false після підключення реального акаунту
  };
  try {
    await AdMob.showBanner(options);
  } catch {
    // Web environment
  }
}

export async function hideBanner() {
  try {
    await AdMob.hideBanner();
  } catch {}
}

let interstitialReady = false;

export async function preloadInterstitial() {
  const options: AdOptions = {
    adId: AD_IDS.interstitial,
    isTesting: true, // TODO: змінити на false після підключення реального акаунту
  };
  try {
    await AdMob.prepareInterstitial(options);
    interstitialReady = true;
  } catch {
    interstitialReady = false;
  }
}

export async function showInterstitial() {
  if (!interstitialReady) return;
  try {
    await AdMob.showInterstitial();
    interstitialReady = false;
    // Підготуй наступний одразу після показу
    setTimeout(preloadInterstitial, 2000);
  } catch {}
}
