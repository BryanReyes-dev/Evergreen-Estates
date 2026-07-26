import React from 'react'
import Menu from './Menu'

type Props = {}

const Header = (props: Props) => {
  return (
    <div className="flex w-full items-center bg-[#202324] ">
                
        <img className="w-10 h-10 mx-1"  src={"/images/logo/evergreen_logo.png"}/>


        <span className="text-3xl mt-1 text-[#228000]">
            EverGreen Estates
        </span>

        

        <nav className="ml-auto  justify-end  mr-2">

            <div className="xs:hidden">
                <Menu/>
            </div>


            
        </nav>

    </div>
  )
}

export default Header