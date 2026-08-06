import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn(
        "data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="center"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col">
        <SliderPrimitive.Track
  data-slot="slider-track"
  className="
    relative
    grow
    overflow-hidden
    rounded-full
    bg-[#227d03]
    !h-1
    w-full
    
  "
>
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-[orientation=horizontal]:h-full h-full data-[orientation=vertical]:w-full"
          />
        </SliderPrimitive.Track>

        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="
              !h-3 
              !w-3 
              shrink-0
              rounded-full
              border-[2px]
              bg-white
              shadow-sm
            "
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }