import React from 'react'

type Props = {}

const Footer = (props: Props) => {
  return (
    <div className="bg-[#202324] text-[#228100] p-4">
      <div className="container mx-auto">
        <p>&copy; {new Date().getFullYear()} Evergreen Estates. All rights reserved.</p>
      </div>
    </div>
  )
}

export default Footer