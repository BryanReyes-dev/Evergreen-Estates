
import Footer from "../../components/Layout/Footer";
import Header from "../../components/Layout/Header";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    
    <>
      <Header/>
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
    
    
  )
}