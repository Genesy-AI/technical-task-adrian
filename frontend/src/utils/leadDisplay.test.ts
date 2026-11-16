import { describe, it, expect } from 'vitest'
import { toLinkedinLink, toTelHref } from './leadDisplay'

describe('toTelHref', () => {
  it.each([
    ['+1-280-754-0462x2154', 'tel:+12807540462;ext=2154'],
    ['001-464-312-8555', 'tel:0014643128555'],
    ['(760)551-9973x6454', 'tel:7605519973;ext=6454'],
    ['+44 20 7946 0958', 'tel:+442079460958'],
    ['+1 (555) 123-4567 ext. 89', 'tel:+15551234567;ext=89'],
    [' 063.430.8860 ', 'tel:0634308860'],
  ])('maps %j to %j', (phone, href) => {
    expect(toTelHref(phone)).toBe(href)
  })
})

describe('toLinkedinLink', () => {
  it('labels the link with the URL path', () => {
    expect(toLinkedinLink('https://www.linkedin.com/in/ada-lovelace')).toEqual({
      href: 'https://www.linkedin.com/in/ada-lovelace',
      label: 'in/ada-lovelace',
    })
  })

  it('falls back to the hostname when there is no path', () => {
    expect(toLinkedinLink('https://www.linkedin.com/')?.label).toBe('www.linkedin.com')
  })

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'not a url', ''])('refuses to link %j', (url) => {
    expect(toLinkedinLink(url)).toBeNull()
  })
})
