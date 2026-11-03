// What the phone the app runs on tells about itself (Android/iOS system information), and how it maps to the
// catalog: the model (by its marketing name, model name or maker + model code) and the variant (by storage and RAM).
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import type { Brand, Model, Variant } from '@fonzkart/api';
import { sellCategoryOf } from '@fonzkart/core';
import androidModels from './androidModels.json';

export type DeviceSpecs = {
  maker: string;
  /** e.g. "Pixel 7", or a code such as "SM-S911B" on Samsung. */
  modelName: string;
  /** The device name from the system settings: the marketing name by default on many phones ("Galaxy S23"). */
  deviceName: string;
  osName: string;
  osVersion: string;
  ramGb: number | null;
  storageGb: number | null;
  isTablet: boolean;
};

// Android reports a code such as "LE2101", not the name on the box. androidModels.json maps those codes to catalog
// model names (generated from Google Play's supported devices list).
const ANDROID_MODELS: Record<string, string> = androidModels;


const STORAGE_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048];
const RAM_SIZES = [1, 2, 3, 4, 6, 8, 10, 12, 16, 18, 24, 32];
const GB = 1024 ** 3;

/** The smallest standard size at least as big as the reported one (phones report a bit less than the label). */
export function standardSize(reportedGb: number, sizes: number[]): number {
  return sizes.find(s => s >= reportedGb * 0.98) ?? Math.round(reportedGb);
}

export function readDeviceSpecs(): DeviceSpecs | null {
        if (Platform.OS === 'web') return null;
  const maker = (Device.brand ?? Device.manufacturer ?? '').trim();
  const modelName = (Device.modelName ?? '').trim();
  if (!maker && !modelName) return null;
  let storage: number | null = null;
  try {
    storage = Paths.totalDiskSpace > 0 ? Paths.totalDiskSpace : null;
  } catch {
    storage = null;
  }
  return {
    maker,
    modelName,
    deviceName: (Device.deviceName ?? '').trim(),
    osName: Platform.OS === 'ios' ? 'iOS' : 'Android',
    osVersion: (Device.osVersion ?? '').trim(),
    ramGb: Device.totalMemory ? standardSize(Device.totalMemory / GB, RAM_SIZES) : null,
    storageGb: storage ? standardSize(storage / GB, STORAGE_SIZES) : null,
    isTablet: Device.deviceType === Device.DeviceType.TABLET,
  };
}

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The maker without its sub-brand: the catalog lists Redmi phones under Xiaomi and HMD phones under Nokia. */
const BRAND_ALIASES: Record<string, string> = { redmi: 'xiaomi', mi: 'xiaomi', hmd: 'nokia', 'hmd global': 'nokia' };

/** The catalog brand of this device's maker. */
export function matchBrand(brands: Brand[] | undefined, specs: DeviceSpecs): Brand | undefined {
  const maker = normal(specs.maker);
  if (!maker) return undefined;
  const want = BRAND_ALIASES[maker] ?? maker;
  return brands?.find(b => normal(b.name) === want || b.id === want);
}

/** A name the customer would recognise even when the catalog lacks it: iPhones and iPads report their real name. */
export function deviceTitle(specs: DeviceSpecs): string | null {
  return specs.osName === 'iOS' && specs.modelName ? specs.modelName : null;
}

/**
 * Names to look the device up by, best first, without repeats (three at most, one search each). iPhones and iPads
 * report their model name reliably, and their device name is often just "iPhone". On Android the model code gives the
 * catalog name when it is in the table; else the device name is the marketing name unless renamed, and the catalog
 * often leaves out "5G".
 */
export function searchNames(specs: DeviceSpecs): string[] {
  const maker = new RegExp(`^${specs.maker.replace(/[^A-Za-z0-9]/g, '')}\\s+`, 'i');
  const plain = (name: string) => name.replace(maker, '').replace(/\s+[45]G$/i, '').trim();
  const names = specs.osName === 'iOS'
    ? [specs.modelName]
    : [ANDROID_MODELS[specs.modelName.toUpperCase()] ?? '', specs.deviceName, plain(specs.deviceName), specs.modelName, `${specs.maker} ${specs.modelName}`];
  const seen = new Set<string>();
  return names.filter(n => {
    const key = normal(n);
    if (key.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

/** The catalog model for one name: an exact name match, then among phones or tablets one ending with it, then (for a specific name such as "Galaxy S23") one containing it. */
export function matchModel(models: Model[] | undefined, name: string, isTablet: boolean): Model | undefined {
  if (!models?.length) return undefined;
  const want = normal(name);
  const exact = models.find(m => normal(m.name) === want);
  if (exact) return exact;
  const kind = isTablet ? 'tablet' : 'smartphone';
  const fits = models.filter(m => sellCategoryOf(m.category) === kind);
  const specific = want.includes(' ') && /\d/.test(want);
  return fits.find(m => normal(m.name).endsWith(` ${want}`))
    ?? (specific ? fits.find(m => normal(m.name).includes(want)) : undefined);
}

/** Sizes written in a variant name: "8 GB / 128 GB" → RAM 8, storage 128; "1TB" → storage 1024. */
export function variantSizes(name: string): { ramGb: number | null; storageGb: number | null } {
  const sizes = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(GB|TB)/gi)].map(m => parseFloat(m[1]!) * (m[2]!.toUpperCase() === 'TB' ? 1024 : 1));
  if (!sizes.length) return { ramGb: null, storageGb: null };
  const storageGb = Math.max(...sizes);
  return { storageGb, ramGb: sizes.length > 1 ? Math.min(...sizes) : null };
}

/** The variant with this phone's storage (and RAM, when the names give it); none when the storage is unknown or absent. */
export function matchVariant(variants: Variant[] | undefined, specs: DeviceSpecs): Variant | undefined {
  if (!variants?.length || !specs.storageGb) return undefined;
  let best: Variant | undefined;
  let bestScore = 0;
  for (const v of variants) {
    const { ramGb, storageGb } = variantSizes(v.name);
    if (storageGb !== specs.storageGb) continue;
    const score = 10 + (ramGb !== null && ramGb === specs.ramGb ? 3 : 0);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}
