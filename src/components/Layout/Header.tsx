import React from 'react'
import Menu from './Menu'
import Nav from './Nav'

type Props = {}

const Header = (props: Props) => {
  return (
    <div className="flex w-full items-center bg-[#141616] ">
                
        <img className="w-11 flex items-center  h-11 mx-1"  src={"/images/logo/evergreen_logo.png"}/>


        <span className="text-3xl my-1 text-white font-semibold">
            EverGreen Estates
        </span>

        

        <nav className="ml-auto  justify-end   my-2 mr-2">

            <div className="xs:hidden">
                <Menu/>
            </div>
            <Nav/>


            
        </nav>

    </div>
  )
}

export default Header