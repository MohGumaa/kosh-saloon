import { LogoProps } from '@/types';
import { Scissors } from 'lucide-react';

const KoshLogo = ({ label="صالون كوش", ClassName, labelClassName="text-3xl md:text-5xl", iconClassName="size-7 md:size-10" }: LogoProps) => {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 text-white select-none ${ClassName}`}
    >
      <span className={`font-semibold leading-none ${labelClassName}`}>{label}</span>
      <Scissors className={iconClassName} />
    </div>
  )
}

export default KoshLogo
