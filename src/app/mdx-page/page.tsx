import Welcome, {tableOfContents} from '~/markdown/welcome.mdx'

export default function Page() {
  console.log(tableOfContents)
  return <Welcome />
}