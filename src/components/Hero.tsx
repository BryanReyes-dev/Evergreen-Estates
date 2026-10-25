const Hero = () => {
  return (
    <section className="relative flex min-h-[75svh] w-full items-center bg-[url(/images/header-bg.jpg)] med:bg-[url(/images/home-image.jpg)] bg-cover bg-center sm:min-h-[82svh] lg:min-h-[90svh]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#141616] to-[#141616]/50"
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <h1
          className="max-w-4xl text-3xl font-semibold leading-tight font-sans sm:text-4xl md:text-6xl"
          style={{
            color: "#228100",
            opacity: 0.9,
            textShadow: "0 3px 3px rgba(0, 0, 0, .7)",
          }}
        >
          Welcome To Evergreen Estates
        </h1>
        <p
          className="mt-4 max-w-4xl text-xl font-semibold leading-snug font-sans text-[#228100] sm:text-2xl md:text-4xl"
          style={{ textShadow: "0 4px 5px rgba(0, 0, 0, .7)" }}
        >
          Where Comfort Meets Convenience
        </p>
      </div>
    </section>
  );
};

export default Hero;
