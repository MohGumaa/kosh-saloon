import { Scissors } from 'lucide-react';

const KoshLogo = () => {
  return (
    <div
      className="flex items-center gap-2 text-white select-none"
    >
      <p className="text-3xl md:text-5xl font-semibold leading-none">صالون كوش</p>
      <Scissors className="size-7 md:size-10" />
    </div>
  )
}

export default KoshLogo
