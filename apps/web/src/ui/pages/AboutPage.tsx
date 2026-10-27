import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { links } from '@rawiaudio/shared/ui/links.ts'
import { PageTitle } from '../components/PageTitle.tsx'
import { Link } from '../navigation.tsx'

/** Qui fait Rawi, et où le joindre : le site, la confidentialité, les mentions légales, l'adresse de contact. */
export function AboutPage() {
  return (
    <>
      <Link href="/" className="back">
        {fr.backToCatalog}
      </Link>
      <PageTitle title={fr.about} className="page-heading">
        {fr.about}
      </PageTitle>
      <p>{fr.aboutText}</p>
      <ul className="about-links">
        <li>
          <a href={links.site}>{fr.website}</a>
        </li>
        <li>
          <a href={links.privacy}>{fr.privacy}</a>
        </li>
        <li>
          <a href={links.legalNotice}>{fr.legalNotice}</a>
        </li>
      </ul>
      <h2>{fr.writeToUs}</h2>
      {/* L'adresse est écrite en toutes lettres : sans logiciel de messagerie, le lien ne s'ouvre pas. */}
      <p>
        <a href={`mailto:${links.contact}`}>{links.contact}</a>
      </p>
    </>
  )
}
