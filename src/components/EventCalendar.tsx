
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { es } from 'date-fns/locale';
import { isMonday, isTuesday, isWednesday, isThursday, isFriday, isSaturday, isSunday, lastDayOfMonth, eachDayOfInterval, startOfMonth } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

const EventCalendar = () => {
    const [date, setDate] = useState<Date>(new Date());
    const currentMonth = startOfMonth(date);

    const eventDays = useMemo(() => {
        const daysInMonth = eachDayOfInterval({
            start: currentMonth,
            end: lastDayOfMonth(currentMonth),
        });

        const mondays = daysInMonth.filter(isMonday);
        const tuesdays = daysInMonth.filter(isTuesday);
        const wednesdays = daysInMonth.filter(isWednesday);
        const thursdays = daysInMonth.filter(isThursday);
        const fridays = daysInMonth.filter(isFriday);
        const saturdays = daysInMonth.filter(isSaturday);
        const sundays = daysInMonth.filter(isSunday);

        return {
            loco5ta: [...mondays, ...wednesdays, ...fridays],
            loco4ta: [...mondays, ...thursdays, ...sundays],
            loco3ra: [...tuesdays, ...saturdays],
            loco2da: [...wednesdays, ...fridays],
            loco1ra: [...mondays, ...saturdays],
        };
    }, [currentMonth]);

    const modifiers = {
        loco5ta: eventDays.loco5ta,
        loco4ta: eventDays.loco4ta,
        loco3ra: eventDays.loco3ra,
        loco2da: eventDays.loco2da,
        loco1ra: eventDays.loco1ra,
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="text-primary" />
                     <span className="text-yellow-400">Calendario de Eventos</span>
                </CardTitle>
                <CardDescription>Consulta las fechas de los próximos eventos programados.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
                 <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    month={currentMonth}
                    onMonthChange={(month) => setDate(month)}
                    locale={es}
                    className="rounded-md border p-4"
                    modifiers={modifiers}
                    components={{
                       DayContent: (props) => {
                            const { date, activeModifiers } = props;
                            const isLoco5ta = activeModifiers.loco5ta;
                            const isLoco4ta = activeModifiers.loco4ta;
                            const isLoco3ra = activeModifiers.loco3ra;
                            const isLoco2da = activeModifiers.loco2da;
                            const isLoco1ra = activeModifiers.loco1ra;

                            return (
                                <div className="relative flex h-full w-full flex-col items-center justify-center">
                                    <span>{date.getDate()}</span>
                                    <div className="absolute -bottom-1 flex flex-wrap justify-center gap-0.5 max-w-[30px]">
                                        {isLoco5ta && <div className="h-1 w-1 rounded-full bg-cyan-400" />}
                                        {isLoco4ta && <div className="h-1 w-1 rounded-full bg-orange-400" />}
                                        {isLoco3ra && <div className="h-1 w-1 rounded-full bg-yellow-400" />}
                                        {isLoco2da && <div className="h-1 w-1 rounded-full bg-pink-400" />}
                                        {isLoco1ra && <div className="h-1 w-1 rounded-full bg-purple-500" />}
                                    </div>
                                </div>
                            );
                        }
                    }}
                />
                 <div className="mt-6 w-full max-w-sm space-y-4">
                    <h4 className="font-semibold text-center text-lg text-primary/90">Leyenda</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-cyan-400" />
                                <span>6 Loco 5ta</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-orange-400" />
                                <span>6 Loco 4ta</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                                <span>6 Loco 3ra</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-pink-400" />
                                <span>6 Loco 2da</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 rounded-full bg-purple-500" />
                                <span>6 Loco 1ra</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default EventCalendar;
