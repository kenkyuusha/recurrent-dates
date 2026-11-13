// ABOUTME: Contract for the wording of ages and day names in English and Russian,
// ABOUTME: where Russian needs three plural forms.

import { describe, expect, it } from 'vitest';
import { ageLabel, dayLabel, resolveLang } from '../src/core/i18n';

describe('ageLabel', () => {
	it('uses English singular and plural', () => {
		expect(ageLabel(1, 'en')).toBe('1 year ago');
		expect(ageLabel(132, 'en')).toBe('132 years ago');
		expect(ageLabel(0, 'en')).toBe('this year');
		expect(ageLabel(-1, 'en')).toBe('in 1 year');
		expect(ageLabel(-3, 'en')).toBe('in 3 years');
	});

	it('uses the three Russian plural forms', () => {
		expect(ageLabel(1, 'ru')).toBe('1 год назад');
		expect(ageLabel(2, 'ru')).toBe('2 года назад');
		expect(ageLabel(5, 'ru')).toBe('5 лет назад');
		expect(ageLabel(11, 'ru')).toBe('11 лет назад');
		expect(ageLabel(21, 'ru')).toBe('21 год назад');
		expect(ageLabel(111, 'ru')).toBe('111 лет назад');
		expect(ageLabel(132, 'ru')).toBe('132 года назад');
		expect(ageLabel(0, 'ru')).toBe('в этом году');
		expect(ageLabel(-3, 'ru')).toBe('через 3 года');
	});
});

describe('dayLabel', () => {
	it('names the day without a year', () => {
		expect(dayLabel(12, 8, 'en')).toBe('8 December');
		expect(dayLabel(12, 8, 'ru')).toBe('8 декабря');
		expect(dayLabel(2, 29, 'en')).toBe('29 February');
	});
});

describe('resolveLang', () => {
	it('falls back to English for anything but Russian', () => {
		expect(resolveLang('ru')).toBe('ru');
		expect(resolveLang('ru-RU')).toBe('ru');
		expect(resolveLang('en-GB')).toBe('en');
		expect(resolveLang('ja')).toBe('en');
		expect(resolveLang(undefined)).toBe('en');
	});
});
