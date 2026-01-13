export interface LoginUser {
    kindergarten_id: string;
    name: string;
    settings: {
        course_type: string;
        has_bread_day: boolean;
        has_curry_day: boolean;
        has_birthday_party: boolean;
        service_mon?: boolean;
        service_tue?: boolean;
        service_wed?: boolean;
        service_thu?: boolean;
        service_fri?: boolean;
        service_sat?: boolean;
        service_sun?: boolean;
    };
}

export interface Order {
    order_id?: string;
    kindergarten_id: string;
    date: string;
    class_name: string;
    meal_type: string;
    student_count: number;
    allergy_count: number;
    teacher_count: number;
    memo?: string;
    updated_at?: string;
}

export interface ClassMaster {
    class_name: string;
    grade: string;
    default_student_count: number;
    default_allergy_count?: number;
    default_teacher_count: number;
}
