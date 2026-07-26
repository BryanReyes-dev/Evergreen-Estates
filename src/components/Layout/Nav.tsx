import Link from "next/link";
import link from "next/link";

const Nav = () => {
    return (

        <div className="justify-end sm:flex hidden gap-2 ml-auto">


            {/* Heart svg*/}
            <svg viewBox="0 0 24 24" fill="none" className="text-[#228100] md:w-20 w-10 justify-end ml-auto" xmlns="http://www.w3.org/2000/svg">
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                <g id="SVGRepo_iconCarrier"> 
                <path fillRule="evenodd" clipRule="evenodd" d="M12 6.00019C10.2006 3.90317 7.19377 3.2551 4.93923 5.17534C2.68468 7.09558 2.36727 10.3061 4.13778 12.5772C5.60984 14.4654 10.0648 18.4479 11.5249 19.7369C11.6882 19.8811 11.7699 19.9532 11.8652 19.9815C11.9483 20.0062 12.0393 20.0062 12.1225 19.9815C12.2178 19.9532 12.2994 19.8811 12.4628 19.7369C13.9229 18.4479 18.3778 14.4654 19.8499 12.5772C21.6204 10.3061 21.3417 7.07538 19.0484 5.17534C16.7551 3.2753 13.7994 3.90317 12 6.00019Z" stroke="currentcolor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                </path> 
                </g>
            </svg>

            {/* Hoursglass svg*/}
            <Link href="/search" className="flex  bg-[#3a3f42]  rounded-md  border-black border shadow-lg shadow-[#228100]/70 hover:border-[#228100] hover:scale-105 transition-all duration-300 ease-in-out">
                <svg  version="1.1" id="Layer_1" className="text-[#228100] md:w-20 w-10" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" enableBackground="new 0 0 50 50"  fill="#228100">
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier"> 
                    <path fill="#228100" d="M20.745,32.62c2.883,0,5.606-1.022,7.773-2.881L39.052,40.3c0.195,0.196,0.452,0.294,0.708,0.294 c0.255,0,0.511-0.097,0.706-0.292c0.391-0.39,0.392-1.023,0.002-1.414L29.925,28.319c3.947-4.714,3.717-11.773-0.705-16.205 c-2.264-2.27-5.274-3.52-8.476-3.52s-6.212,1.25-8.476,3.52c-4.671,4.683-4.671,12.304,0,16.987 C14.533,31.37,17.543,32.62,20.745,32.62z M13.685,13.526c1.886-1.891,4.393-2.932,7.06-2.932s5.174,1.041,7.06,2.932 c3.895,3.905,3.895,10.258,0,14.163c-1.886,1.891-4.393,2.932-7.06,2.932s-5.174-1.041-7.06-2.932 C9.791,23.784,9.791,17.431,13.685,13.526z"></path></g>
                </svg>
            </Link>

            {/* User svg*/}
            <svg viewBox="0 0 24 24" fill="none" className="text-[#228100] md:w-20 w-10" xmlns="http://www.w3.org/2000/svg">
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                <g id="SVGRepo_iconCarrier"> 
                <circle cx="12" cy="9" r="3"  strokeWidth="1" stroke="currentcolor" ></circle> 
                <circle cx="12" cy="12" r="10"  strokeWidth="1" stroke="currentcolor" ></circle> 
                <path stroke="currentcolor"  d="M17.9691 20C17.81 17.1085 16.9247 15 11.9999 15C7.07521 15 6.18991 17.1085 6.03076 20" strokeWidth="1" strokeLinecap="round"></path> </g>
            </svg>

            
        </div>


)}


export default Nav;