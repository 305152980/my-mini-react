interface Props {
  [key: string]: any
}

function isCustomComponent(tagName: string, props: Props): boolean {
  if (tagName.indexOf('-') === -1) {
    return typeof props.is === 'string'
  }
  switch (tagName) {
    case 'annotation-xml':
    case 'color-profile':
    case 'font-face':
    case 'font-face-src':
    case 'font-face-uri':
    case 'font-face-format':
    case 'font-face-name':
    case 'missing-glyph':
      return false
    default:
      return true
  }
}

export default isCustomComponent
