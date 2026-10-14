import { Trans } from '@lingui/react/macro';
import { format } from 'date-fns/format';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { Locale, es, it } from 'date-fns/locale';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { ToolTipText } from './ToolTipText.js';

const localeMap: Record<string, Locale> = { es, it, pseudo: es };

export const PastDistanceToNow = (props: {
  date: Date;
  weekday?: boolean;
}): React.JSX.Element => {
  return <DistanceToNow isPast={true} {...props} />;
};

export const DistanceToNow = (props: {
  date: Date;
  isPast?: boolean;
  weekday?: boolean;
}): React.JSX.Element => {
  const { locale } = useRouter();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <>{props.date.toISOString()}</>;
  }

  const dateFnsLocale = locale ? localeMap[locale] : undefined;
  const tooltipDate = props.date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (props.isPast && !props.weekday && props.date > new Date()) {
    return (
      <ToolTipText
        text={<Trans>just now</Trans>}
        tooltip={props.date.toISOString()}
      />
    );
  }
  const text = props.weekday
    ? //EEEE is a format code for weekdays, it means format the full name not just the first 3 letters
      format(props.date, 'EEEE', { locale: dateFnsLocale })
    : formatDistanceToNow(props.date, {
        addSuffix: true,
        locale: dateFnsLocale,
      });
  return <ToolTipText text={text} tooltip={tooltipDate} />;
};
