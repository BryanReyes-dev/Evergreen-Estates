const COPYRIGHT_YEAR = new Date().getFullYear();

const Footer = () => {
  return (
    <div className="bg-[#141616] text-[#228100] p-4">
      <div className="container mx-auto">
        <p>&copy; {COPYRIGHT_YEAR} Evergreen Estates. All rights reserved.</p>
      </div>
    </div>
  )
}

export default Footer